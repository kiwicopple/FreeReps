import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type uPlot from "uplot";
import MetricTrendChart from "../src/components/dashboard/MetricTrendChart";
const capture = vi.hoisted(() => ({
  opts: undefined as uPlot.Options | undefined,
  data: undefined as uPlot.AlignedData | undefined,
}));
vi.mock("../src/components/AutoSizeUplot", () => ({
  default: ({
    opts,
    data,
  }: {
    opts: uPlot.Options;
    data: uPlot.AlignedData;
  }) => {
    capture.opts = opts;
    capture.data = data;
    return null;
  },
}));
vi.mock("../src/theme", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));
// Narrow charts must format large axes compactly, label actual dates, and retain missing-day gaps.
it("keeps chart units, gap semantics and UTC bucket labels intact", () => {
  const start = Date.UTC(2025, 0, 1);
  const days = [0, null, 1000].map((value, i) => ({
    time: start + i * 86400000,
    value,
  }));
  render(
    <MetricTrendChart days={days} unit="count" cumulative label="Steps" />,
  );
  expect(capture.data?.[1]).toEqual([0, null, 1000]);
  expect(capture.opts?.series[1].spanGaps).toBe(false);
  const yValues = capture.opts!.axes![1].values;
  if (typeof yValues !== "function")
    throw new Error("Expected numeric axis formatter");
  expect(yValues({} as uPlot, [0, 200, 1000], 1, 1, 1)).toEqual([
    "0",
    "200",
    "1 000",
  ]);
  const xValues = capture.opts!.axes![0].values;
  if (typeof xValues !== "function")
    throw new Error("Expected date axis formatter");
  expect(xValues({} as uPlot, [start / 1000], 0, 1, 1)).toEqual(["Jan 1"]);
});
