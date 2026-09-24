import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { metricDays, personalComparison } from "../src/utils/metricInsight";
import { getMetricInfo } from "../src/utils/metricInfo";
import type { FrontPageMetric } from "../src/api";
const DAY = 86400000;
const today = Date.UTC(2025, 0, 15);
const metric: FrontPageMetric = {
  metric_name: "blood_oxygen_saturation",
  label: "Oxygen",
  category: "cardiovascular",
  unit: "%",
  is_cumulative: false,
  multiplier: 100,
  source: "Synthetic",
  time: "2025-01-15T00:00:00Z",
  latest: 0,
  delta_7d: null,
  delta_7d_pct: null,
  range_low: null,
  range_high: null,
  series: [0, null, 0.98, NaN],
};

describe("personal metric context", () => {
  // Percent fractions and gaps must not turn into wrong units or false zero readings.
  it("scales once, retains true zero and gaps, and uses the server's dated buckets", () => {
    const days = metricDays(metric, "2025-01-01T00:00:00Z");
    expect(days.map((p) => p.value)).toEqual([0, null, 98, null]);
    expect(days[1].time).toBe(Date.UTC(2025, 0, 2));
    expect(metricDays(metric, "")).toEqual([]);
  });
  // Partial current-day activity must not look like a week of falling activity.
  it("compares complete weeks and keeps the earlier typical range independent", () => {
    const days = Array.from({ length: 30 }, (_, i) => ({
      time: today - (29 - i) * DAY,
      value: i < 22 ? 40 : i < 29 ? 50 : 9999,
    }));
    const result = personalComparison(days, today + 12 * 3600000);
    expect(result).toMatchObject({
      recentMean: 50,
      previousMean: 40,
      change: 10,
      motion: "rising",
      recentCount: 7,
      previousCount: 7,
      referenceCount: 21,
      typical: [40, 40],
    });
  });
  // Sparse or old readings must not receive a confident personal trend verdict.
  it("requires enough readings in both recent weeks rather than the latest recorded week", () => {
    const sparse = Array.from({ length: 14 }, (_, i) => ({
      time: today - (14 - i) * DAY,
      value: i < 10 ? null : 0,
    }));
    expect(personalComparison(sparse, today)).toMatchObject({
      recentMean: 0,
      previousMean: null,
      change: null,
      motion: "unknown",
      typical: null,
    });
    expect(personalComparison(sparse, today + 60 * DAY).recentCount).toBe(0);
    const completeZero = sparse.map((p) => ({ ...p, value: 0 }));
    expect(personalComparison(completeZero, today)).toMatchObject({
      change: 0,
      motion: "steady",
    });
  });
  // Targets for clinical data, body mass and unknown metrics must not be invented.
  it("keeps context-dependent metrics neutral and supplies a safe unknown fallback", () => {
    for (const name of [
      "weight_body_mass",
      "blood_pressure_systolic",
      "blood_glucose",
      "blood_oxygen_saturation",
      "insulin_delivery",
      "sleep_analysis",
      "new_metric",
    ])
      expect(getMetricInfo(name).direction).toBe("context");
    expect(getMetricInfo("heart_rate_variability").direction).toBe("higher");
    expect(getMetricInfo("new_metric").summary).toContain("not yet available");
    expect(getMetricInfo("dietary_protein").summary).toContain("amino acids");
  });
  // Every metric shipped by this repository needs education, even if it has no readings yet.
  it("covers all registered metrics without falling back to an unknown definition", () => {
    const files = [
      "000001_init.up.sql",
      "000008_healthbeat_types.up.sql",
      "000010_oura.up.sql",
      "000024_training_tonnage_metric.up.sql",
      "000026_withings.up.sql",
    ];
    const names = new Set(
      files.flatMap((file) =>
        [
          ...readFileSync(
            join(process.cwd(), "../migrations", file),
            "utf8",
          ).matchAll(
            /\('([a-z][a-z0-9_]+)',\s*'(?:activity|body|cardiovascular|sleep|fitness|lab|hearing|respiratory|other|nutrition|oura|training)'/g,
          ),
        ].map((m) => m[1]),
      ),
    );
    expect(names.size).toBeGreaterThan(100);
    expect(
      [...names].filter((name) =>
        getMetricInfo(name).summary.includes("not yet available"),
      ),
    ).toEqual([]);
  });
});
