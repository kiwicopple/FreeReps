import { useMemo } from "react";
import type uPlot from "uplot";
import AutoSizeUplot from "../AutoSizeUplot";
import { useTheme } from "../../theme";
import { tokenColor } from "../../utils/tokenColor";
import { formatNumber } from "../../utils/format";
import type { MetricDay } from "../../utils/metricInsight";

const dayLabel = (time: number) =>
  new Date(time).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
/** True dated buckets, with gaps intact and readable axis labels inside a narrow sheet. */
export default function MetricTrendChart({
  days,
  unit,
  cumulative,
  label,
}: {
  days: MetricDay[];
  unit: string;
  cumulative: boolean;
  label: string;
}) {
  const { resolvedTheme } = useTheme();
  const { opts, data } = useMemo(() => {
    const axis = tokenColor("--muted-foreground");
    const grid = tokenColor("--border");
    const opts: uPlot.Options = {
      width: 0,
      height: 220,
      series: [
        {
          label: "Day",
          value: (_u, v) => (v == null ? "—" : dayLabel(v * 1000)),
        },
        {
          label: cumulative ? "Daily total" : "Daily average",
          stroke: tokenColor("--color-data-3"),
          width: 2,
          spanGaps: false,
          points: { show: true, size: days.length > 90 ? 2 : 4 },
          value: (_u, v) =>
            v == null ? "—" : `${formatNumber(v)} ${unit}`.trim(),
        },
      ],
      axes: [
        {
          stroke: axis,
          grid: { show: false },
          ticks: { stroke: grid },
          space: 85,
          size: 38,
          font: "11px Archivo, system-ui, sans-serif",
          splits: (u) => {
            const every = Math.max(
              1,
              Math.ceil(days.length / Math.max(1, (u.width - 50) / 85)),
            );
            return days
              .filter((_p, i) => i % every === 0)
              .map((p) => p.time / 1000);
          },
          values: (_u, values) => values.map((v) => dayLabel(v * 1000)),
        },
        {
          stroke: axis,
          grid: { stroke: grid },
          ticks: { show: false },
          size: 50,
          font: "11px Archivo, system-ui, sans-serif",
          values: (_u, values) => values.map((v) => formatNumber(v)),
        },
      ],
      scales: {
        x: {
          time: true,
          range: () => [
            days[0].time / 1000 - 43200,
            days[days.length - 1].time / 1000 + 43200,
          ],
        },
      },
      cursor: { drag: { x: false, y: false } },
      legend: { show: true },
    };
    return {
      opts,
      data: [
        days.map((p) => p.time / 1000),
        days.map((p) => p.value),
      ] as uPlot.AlignedData,
    };
  }, [days, unit, cumulative, resolvedTheme]);
  return (
    <div
      className="min-w-0"
      role="img"
      aria-label={`${label} daily ${cumulative ? "totals" : "averages"} trend; exact readings are available in Daily values below`}
    >
      <AutoSizeUplot opts={opts} data={data} />
    </div>
  );
}
