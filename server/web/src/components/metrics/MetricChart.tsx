import { useMemo } from "react";
import type { TimeSeriesPoint } from "../../api";
import { formatDayMonth, formatNumber } from "../../utils/format";

/* The plot geometry from the design, in viewBox units. The SVG scales
   proportionally, so these stay fixed regardless of the pane's width. */
const W = 1080;
const H = 420;
const PLOT_LEFT = 56;
const PLOT_RIGHT = W;
const BASELINE = H - 42;
const PLOT_TOP = 16;

interface Props {
  points: TimeSeriesPoint[];
  multiplier: number;
  unit: string;
}

/**
 * Layers, back to front: the normal-range band, gridlines, the 2px baseline,
 * the 7-day rolling mean, then the daily value. The band is what turns
 * "62.8 ms" into "62.8 ms, which is high for you".
 */
export default function MetricChart({ points, multiplier, unit }: Props) {
  const model = useMemo(
    () => buildModel(points, multiplier),
    [points, multiplier],
  );

  if (!model) {
    return (
      <p style={{ color: "var(--color-neutral-600)", fontSize: 13 }}>
        No samples in this window.
      </p>
    );
  }

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: H, display: "block" }}
        role="img"
        aria-label={`Daily values${unit ? ` in ${unit}` : ""} over the selected window`}
      >
        {model.band ? (
          <rect
            x={PLOT_LEFT}
            y={model.band.top}
            width={PLOT_RIGHT - PLOT_LEFT}
            height={model.band.height}
            fill="var(--color-data-band)"
          />
        ) : null}

        {model.yTicks.map((t) => (
          <g key={t.y}>
            <line
              x1={PLOT_LEFT}
              x2={PLOT_RIGHT}
              y1={t.y}
              y2={t.y}
              stroke="var(--color-neutral-300)"
              strokeWidth={1}
            />
            <text
              x={PLOT_LEFT - 10}
              y={t.y + 4}
              textAnchor="end"
              fontSize={12}
              fill="var(--color-neutral-600)"
            >
              {t.label}
            </text>
          </g>
        ))}

        <line
          x1={PLOT_LEFT}
          x2={PLOT_RIGHT}
          y1={BASELINE}
          y2={BASELINE}
          stroke="var(--color-text)"
          strokeWidth={2}
        />

        {model.mean ? (
          <polyline
            points={model.mean}
            fill="none"
            stroke="var(--color-neutral-500)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        ) : null}

        {model.line ? (
          <polyline
            points={model.line}
            fill="none"
            stroke="var(--color-data-3)"
            strokeWidth={2}
          />
        ) : null}

        {model.xTicks.map((t) => (
          <text
            key={t.x}
            x={t.x}
            y={H - 14}
            textAnchor="middle"
            fontSize={12}
            fill="var(--color-neutral-600)"
          >
            {t.label}
          </text>
        ))}
      </svg>

      <div
        style={{
          display: "flex",
          gap: 28,
          marginTop: 6,
          paddingLeft: 56,
          flexWrap: "wrap",
        }}
      >
        <LegendItem label="Daily value">
          <span
            style={{ width: 16, height: 2, background: "var(--color-data-3)" }}
          />
        </LegendItem>
        <LegendItem label="7-day rolling mean">
          <span
            style={{
              width: 16,
              height: 0,
              borderTop: "1.5px dashed var(--color-neutral-500)",
            }}
          />
        </LegendItem>
        <LegendItem label="Normal range (p25–p75)">
          <span
            style={{
              width: 16,
              height: 10,
              background: "var(--color-data-band)",
            }}
          />
        </LegendItem>
      </div>
    </>
  );
}

function LegendItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        font: "500 11.5px var(--font-body)",
        color: "var(--color-neutral-700)",
      }}
    >
      {children}
      {label}
    </span>
  );
}

interface ChartModel {
  band: { top: number; height: number } | null;
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
  line: string | null;
  mean: string | null;
}

function buildModel(
  points: TimeSeriesPoint[],
  multiplier: number,
): ChartModel | null {
  const values = points.map((p) =>
    p.avg == null ? null : p.avg * multiplier,
  );
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return null;

  const min = Math.min(...present);
  const max = Math.max(...present);
  // A flat series would divide by zero; give it a nominal band to sit in.
  const pad = (max - min || Math.abs(max) || 1) * 0.1;
  const lo = min - pad;
  const hi = max + pad;
  const yFor = (v: number) =>
    BASELINE - ((v - lo) / (hi - lo)) * (BASELINE - PLOT_TOP);
  const xFor = (i: number) =>
    points.length === 1
      ? PLOT_LEFT
      : PLOT_LEFT + (i / (points.length - 1)) * (PLOT_RIGHT - PLOT_LEFT);

  const sorted = [...present].sort((a, b) => a - b);
  const p25 = quantile(sorted, 0.25);
  const p75 = quantile(sorted, 0.75);
  const band =
    p75 > p25
      ? { top: yFor(p75), height: yFor(p25) - yFor(p75) }
      : null;

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const v = lo + ((hi - lo) * i) / 4;
    return { y: yFor(v), label: formatNumber(v) };
  });

  const step = Math.max(1, Math.floor(points.length / 6));
  const xTicks: { x: number; label: string }[] = [];
  for (let i = 0; i < points.length; i += step) {
    xTicks.push({ x: xFor(i), label: formatDayMonth(new Date(points[i].time)) });
  }

  const rolling = rollingMean(values, 7);

  return {
    band,
    yTicks,
    xTicks,
    line: toPolyline(values, xFor, yFor),
    mean: toPolyline(rolling, xFor, yFor),
  };
}

function toPolyline(
  values: (number | null)[],
  xFor: (i: number) => number,
  yFor: (v: number) => number,
): string | null {
  const pts = values
    .map((v, i) => (v == null ? null : `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`))
    .filter((p): p is string => p != null);
  return pts.length >= 2 ? pts.join(" ") : null;
}

function rollingMean(
  values: (number | null)[],
  window: number,
): (number | null)[] {
  return values.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - window + 1); j <= i; j++) {
      const v = values[j];
      if (v != null) {
        sum += v;
        n++;
      }
    }
    return n > 0 ? sum / n : null;
  });
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = q * (sorted.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper || sorted[lower] === sorted[upper]) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}
