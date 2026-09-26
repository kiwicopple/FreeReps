import { localToday } from "./localDate";
import type { FrontPageMetric } from "../api";

const DAY = 86_400_000;
export interface MetricDay {
  time: number;
  value: number | null;
}

/** Use calendar coordinates for daily labels; never add elapsed hours across DST. */
export function metricDays(
  metric: FrontPageMetric,
  windowStart: string,
): MetricDay[] {
  const start = Date.parse(windowStart.slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(start)) return [];
  return metric.series.map((raw, index) => ({
    time: start + index * DAY,
    value:
      raw != null && Number.isFinite(raw * metric.multiplier)
        ? raw * metric.multiplier
        : null,
  }));
}

export function quantile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * fraction;
  const lower = Math.floor(pos),
    upper = Math.ceil(pos);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

/** Recent complete weeks, never today's partial totals or a stale sample's date. */
export function personalComparison(
  days: MetricDay[],
  now: number = Date.now(),
) {
  const today = Date.parse(localToday(undefined, new Date(now)) + "T00:00:00Z");
  const recorded = days.filter(
    (p): p is MetricDay & { value: number } =>
      p.value != null &&
      Number.isFinite(p.value) &&
      p.time < today &&
      p.time >= today - 28 * DAY,
  );
  const recent = recorded.filter((p) => p.time >= today - 7 * DAY);
  const previous = recorded.filter(
    (p) => p.time >= today - 14 * DAY && p.time < today - 7 * DAY,
  );
  const mean = (points: typeof recorded) =>
    points.reduce((sum, p) => sum + p.value, 0) / points.length;
  const enough = recent.length >= 4 && previous.length >= 4;
  const recentMean = recent.length ? mean(recent) : null;
  const previousMean = previous.length ? mean(previous) : null;
  const change = enough ? recentMean! - previousMean! : null;
  // Descriptive noise threshold, not a clinical cut-off or a confidence interval.
  const motion =
    change == null
      ? "unknown"
      : Math.abs(change) <= Math.max(Math.abs(previousMean!) * 0.03, 1e-9)
        ? "steady"
        : change > 0
          ? "rising"
          : "falling";
  const reference = recorded
    .filter((p) => p.time < today - 7 * DAY)
    .map((p) => p.value);
  const typical =
    reference.length >= 7
      ? ([quantile(reference, 0.25), quantile(reference, 0.75)] as const)
      : null;
  return {
    recentMean,
    previousMean,
    change,
    motion,
    typical,
    recentCount: recent.length,
    previousCount: previous.length,
    referenceCount: reference.length,
  };
}
