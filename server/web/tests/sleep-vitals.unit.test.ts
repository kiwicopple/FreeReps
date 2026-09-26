import { expect, test } from "vitest";
import type { SleepStage, TimeSeriesPoint } from "../src/api";
import { prepareSleepVitals, sleepWindow } from "../src/utils/sleepVitals";

const start = Date.parse("2025-01-14T23:00:00Z");
const window = { start, end: start + 8 * 3_600_000 };
const point = (
  minutes: number,
  avg: number | null,
  min = avg,
  max = avg,
  count = 1,
): TimeSeriesPoint => ({
  time: new Date(start + minutes * 60_000).toISOString(),
  avg,
  min,
  max,
  count,
});

// Extrema must survive bucketing; frequent sampling must not overweight the mean.
test("15-minute ranges preserve extrema and equally weight five-minute averages", () => {
  const result = prepareSleepVitals(
    [
      point(0, 60, 45, 80, 100),
      point(5, 66, 62, 70, 1),
      point(10, 63, 61, 67, 2),
    ],
    window,
  );
  expect(result.buckets).toEqual([
    {
      start,
      end: start + 15 * 60_000,
      min: 45,
      max: 80,
      avg: 63,
      count: 103,
      intervals: 3,
      hasRange: true,
      partialRange: false,
    },
  ]);
  expect(result.min).toBe(45);
  expect(result.max).toBe(80);
  expect(result.lowestAverage).toEqual({ time: start, value: 60 });
});

// The original low-point statistic is not the minimum observation within a bar.
test("lowest five-minute average remains independent and ties choose the earliest interval", () => {
  const result = prepareSleepVitals(
    [point(40, 50, 48, 53), point(0, 60, 40, 80), point(20, 50, 46, 56)],
    window,
  );
  expect(result.min).toBe(40);
  expect(result.lowestAverage).toEqual({
    time: start + 20 * 60_000,
    value: 50,
  });
  expect(result.buckets.map((b) => b.start)).toEqual([
    start,
    start + 15 * 60_000,
    start + 30 * 60_000,
  ]);
});

// A first bucket may precede sleep, because the server clips raw rows before aggregating.
test("clips partial boundary buckets and rejects observations outside the half-open night", () => {
  const clipped = { start: start + 2 * 60_000, end: start + 37 * 60_000 };
  const result = prepareSleepVitals(
    [point(-5, 55), point(0, 60), point(35, 63), point(40, 64)],
    clipped,
  );
  expect(result.buckets.map((b) => [b.start, b.end])).toEqual([
    [clipped.start, start + 15 * 60_000],
    [start + 30 * 60_000, clipped.end],
  ]);
  expect(result.intervals).toBe(2);
  expect(result.lowestAverage?.time).toBe(clipped.start);
});

// Missing intervals and decimal breathing values must not be interpolated or rounded away.
test("sparse respiratory readings leave missing buckets absent and retain decimals", () => {
  const result = prepareSleepVitals(
    [point(0, 13.5, 10.5, 15.5), point(60, 17.2, 17.2, 17.2)],
    window,
  );
  expect(result.buckets).toHaveLength(2);
  expect(result.buckets[1]).toMatchObject({
    start: start + 60 * 60_000,
    avg: 17.2,
    min: 17.2,
    max: 17.2,
  });
  expect(result.min).toBe(10.5);
});

// Invalid imported rows cannot contaminate the domain; missing extrema are not invented.
test("rejects invalid values and timestamps without turning absent ranges into measured extrema", () => {
  const result = prepareSleepVitals(
    [
      point(0, null),
      point(5, 0),
      point(10, -1),
      point(15, Infinity),
      point(20, NaN),
      { ...point(25, 60), time: "invalid" },
      point(30, 60, 59, 61, 0),
      point(35, 60, null, null),
      point(40, 65, 80, 50),
    ],
    window,
  );
  expect(result.intervals).toBe(2);
  expect(result.min).toBeNull();
  expect(result.max).toBeNull();
  expect(result.buckets[0]).toMatchObject({ avg: 62.5, hasRange: false });
  expect(result.domain.every(Number.isFinite)).toBe(true);
});

// An average-only record must not erase another record's known extrema in the same bar.
test("mixed range availability retains known extrema and labels the bucket partial", () => {
  for (const points of [
    [point(0, 60, 40, 80), point(5, 65, null, null)],
    [point(0, 65, null, null), point(5, 60, 40, 80)],
  ]) {
    const result = prepareSleepVitals(
      [...points, point(15, 70, 69, 71)],
      window,
    );
    expect(result.min).toBe(40);
    expect(result.max).toBe(80);
    expect(result.buckets[0]).toMatchObject({
      min: 40,
      max: 80,
      avg: 62.5,
      hasRange: true,
      partialRange: true,
    });
  }
});

// Empty and flat histories must not divide by zero or imply a normal target range.
test("empty and single-value series retain finite, nonzero chart scales", () => {
  for (const points of [[], [point(0, 14)]]) {
    const result = prepareSleepVitals(points, window);
    expect(result.domain[1]).toBeGreaterThan(result.domain[0]);
    expect(result.domain.every(Number.isFinite)).toBe(true);
  }
  expect(prepareSleepVitals([], window).lowestAverage).toBeNull();
});

// Two 01:00 readings during fall-back are different instants and different bars.
test("DST repeated hours and travel offsets are grouped by elapsed time", () => {
  const a = "2025-11-02T01:00:00-04:00",
    b = "2025-11-02T01:00:00-05:00";
  const result = prepareSleepVitals(
    [
      { ...point(0, 14), time: a },
      { ...point(0, 16), time: b },
    ],
    { start: Date.parse(a), end: Date.parse(b) + 15 * 60_000 },
  );
  expect(result.buckets).toHaveLength(2);
  expect(result.buckets[1].start - result.buckets[0].start).toBe(3_600_000);
});

// Malformed stages must not send an invalid ISO date or poison every block position.
test("window ignores invalid stages while preserving the in-bed span", () => {
  const stage = (
    StartTime: string,
    EndTime: string,
    Stage = "Core",
  ): SleepStage => ({
    StartTime,
    EndTime,
    Stage,
    DurationHr: 1,
    Source: "Synthetic Watch",
  });
  expect(sleepWindow([])).toBeNull();
  expect(sleepWindow([stage("invalid", "invalid")])).toBeNull();
  expect(
    sleepWindow([
      stage("invalid", "invalid"),
      stage("2025-01-14T23:00:00Z", "2025-01-15T01:00:00Z", "In Bed"),
      stage("2025-01-14T23:30:00Z", "2025-01-15T00:00:00Z"),
      stage("2025-01-15T01:00:00Z", "2025-01-14T23:00:00Z"),
    ]),
  ).toEqual({ start, end: start + 2 * 3_600_000 });
});
