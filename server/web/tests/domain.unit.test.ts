import { describe, it, expect } from "vitest";
import { pearsonR, linearRegression, movingAverage } from "../src/utils/stats";
import { fitTrend } from "../src/utils/trend";
import { directionOf } from "../src/utils/metricDirection";
import { nutrientInfo } from "../src/utils/nutrientInfo";
describe("retained analysis and education", () => {
  it("pairs readings and fits the same slope with missing values", () => {
    expect(pearsonR([1, 2, null, 3], [3, 5, 100, 7])).toBe(1);
    expect(linearRegression([1, 2, null, 3], [3, 5, 100, 7])).toEqual({
      slope: 2,
      intercept: 1,
    });
    expect(pearsonR([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(pearsonR([1, 2], [1, 2])).toBeNull();
    expect(movingAverage([null, 2, null, 4], 2)).toEqual([null, 2, 2, 4]);
  });
  it("keeps metric direction and fitted trend classification", () => {
    expect(directionOf("resting_heart_rate")).toBe("lower");
    expect(fitTrend([3, 2, 1], "lower")?.verdict).toBe("improving");
    expect(fitTrend([3, 2, 1], "higher")?.verdict).toBe("declining");
    expect(fitTrend([1, 1, 1], "higher")?.verdict).toBe("flat");
    expect(fitTrend([1, null], "higher")).toBeNull();
  });
  it("retains every nutrient summary with a source link", () => {
    expect(Object.keys(nutrientInfo).length).toBeGreaterThan(35);
    for (const entry of Object.values(nutrientInfo)) {
      expect(entry.summary.length).toBeGreaterThan(40);
      expect(new URL(entry.source).protocol).toBe("https:");
    }
  });
});
