import { describe, expect, it } from "vitest";
import {
  localToday,
  shiftDate,
  dateOnlyToLocalDate,
} from "../src/utils/localDate";
import { metricDays, personalComparison } from "../src/utils/metricInsight";
const metric = {
  metric_name: "heart_rate",
  label: "Heart rate",
  category: "cardiovascular",
  unit: "bpm",
  is_cumulative: false,
  multiplier: 1,
  source: "Synthetic",
  time: "2025-01-15T00:00:00Z",
  latest: 60,
  delta_7d: null,
  delta_7d_pct: null,
  range_low: null,
  range_high: null,
  series: [],
};

describe("travel dates", () => {
  // One instant is two calendar dates across the Pacific; never inherit the server zone.
  it("uses the requested location in both directions", () => {
    const now = new Date("2025-01-15T04:00:00Z");
    expect(localToday("Asia/Singapore", now)).toBe("2025-01-15");
    expect(localToday("America/Los_Angeles", now)).toBe("2025-01-14");
    expect(localToday("America/New_York", now)).toBe("2025-01-14");
    expect(shiftDate("2025-03-09", 1)).toBe("2025-03-10");
    expect(shiftDate("2025-11-02", 1)).toBe("2025-11-03");
    expect(dateOnlyToLocalDate("2025-01-14T00:00:00Z").getDate()).toBe(14);
  });
  // A DST transition must not shift chart labels or make today's partial data enter a baseline.
  it("keeps daily coordinates on their labelled dates", () => {
    const days = metricDays(
      { ...metric, series: [10, 20, 9999] },
      "2025-03-08T00:00:00-08:00",
    );
    expect(
      days.map((p) => new Date(p.time).toISOString().slice(0, 10)),
    ).toEqual(["2025-03-08", "2025-03-09", "2025-03-10"]);
    const now = new Date(2025, 2, 10, 12).getTime();
    expect(personalComparison(days, now).recentMean).toBe(15);
  });
});
