import type { SleepStage, TimeSeriesPoint } from "../api";

export const SAMPLE_INTERVAL = 5 * 60_000;
export const VITAL_BUCKET = 15 * 60_000;
export type SleepVital = "heart_rate" | "respiratory_rate";
export type SleepOverlay = SleepVital | "off";
export type SleepWindow = { start: number; end: number };
export type VitalBucket = {
  start: number;
  end: number;
  avg: number;
  min: number;
  max: number;
  /** The API may have an average without recorded extrema. Never call it a range. */
  hasRange: boolean;
  partialRange: boolean;
  intervals: number;
  count: number;
};

export function sleepWindow(stages: SleepStage[]): SleepWindow | null {
  const valid = stages
    .map((s) => ({
      start: Date.parse(s.StartTime),
      end: Date.parse(s.EndTime),
    }))
    .filter(
      (s) =>
        Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start,
    );
  return valid.length
    ? {
        start: Math.min(...valid.map((s) => s.start)),
        end: Math.max(...valid.map((s) => s.end)),
      }
    : null;
}

const positive = (v: number | null): v is number =>
  v != null && Number.isFinite(v) && v > 0;

/** Combine elapsed-time buckets, never local clock labels (which repeat at DST). */
export function prepareSleepVitals(
  points: TimeSeriesPoint[],
  window: SleepWindow,
) {
  const samples = points
    .flatMap((p) => {
      const time = Date.parse(p.time);
      if (
        !Number.isFinite(time) ||
        !positive(p.avg) ||
        p.count <= 0 ||
        time + SAMPLE_INTERVAL <= window.start ||
        time >= window.end
      )
        return [];
      const hasRange =
        positive(p.min) && positive(p.max) && p.min <= p.avg && p.max >= p.avg;
      return [
        {
          time,
          avg: p.avg,
          min: hasRange ? p.min! : p.avg,
          max: hasRange ? p.max! : p.avg,
          hasRange,
          count: p.count,
        },
      ];
    })
    .sort((a, b) => a.time - b.time);
  const grouped = new Map<number, VitalBucket>();
  for (const sample of samples) {
    const start = Math.floor(sample.time / VITAL_BUCKET) * VITAL_BUCKET;
    const bucket = grouped.get(start);
    if (bucket) {
      // Match the API: each recorded five-minute average has equal weight,
      // independent of the number of watch readings within that interval.
      bucket.avg =
        (bucket.avg * bucket.intervals + sample.avg) / (bucket.intervals + 1);
      if (sample.hasRange) {
        bucket.min = bucket.hasRange
          ? Math.min(bucket.min, sample.min)
          : sample.min;
        bucket.max = bucket.hasRange
          ? Math.max(bucket.max, sample.max)
          : sample.max;
      }
      bucket.hasRange ||= sample.hasRange;
      bucket.partialRange ||= !sample.hasRange;
      if (!bucket.hasRange) bucket.min = bucket.max = bucket.avg;
      bucket.intervals++;
      bucket.count += sample.count;
    } else {
      grouped.set(start, {
        start: Math.max(window.start, start),
        end: Math.min(window.end, start + VITAL_BUCKET),
        avg: sample.avg,
        min: sample.min,
        max: sample.max,
        hasRange: sample.hasRange,
        partialRange: !sample.hasRange,
        intervals: 1,
        count: sample.count,
      });
    }
  }
  const buckets = [...grouped.values()];
  const lowestAverage = samples.reduce<(typeof samples)[number] | null>(
    (low, s) => (!low || s.avg < low.avg ? s : low),
    null,
  );
  const ranges = buckets.filter((b) => b.hasRange);
  const min = ranges.length ? Math.min(...ranges.map((b) => b.min)) : null;
  const max = ranges.length ? Math.max(...ranges.map((b) => b.max)) : null;
  const low = buckets.length
    ? Math.min(...buckets.map((b) => Math.min(b.min, b.avg)))
    : 0;
  const high = buckets.length
    ? Math.max(...buckets.map((b) => Math.max(b.max, b.avg)))
    : 1;
  const padding = Math.max((high - low) * 0.15, 1);
  return {
    buckets,
    lowestAverage: lowestAverage && {
      time: Math.max(window.start, lowestAverage.time),
      value: lowestAverage.avg,
    },
    min,
    max,
    domain: [Math.max(0, low - padding), high + padding] as const,
    intervals: samples.length,
  };
}
