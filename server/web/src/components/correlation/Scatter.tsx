import { formatNumber } from "../../utils/format";
import { linearRegression } from "../../utils/stats";

/* Plot geometry from the design, in viewBox units. */
const W = 720;
const H = 520;
const LEFT = 64;
const RIGHT = 712;
const TOP = 16;
const BASELINE = 476;

interface Props {
  pairs: { x: number; y: number }[];
}

/**
 * Points at r=3.6 with fill-opacity 0.55, then the least-squares line drawn
 * last. The alpha is how overplotting reads as density; shrinking the dots
 * instead would lose it.
 */
export default function Scatter({ pairs }: Props) {
  if (pairs.length < 3) {
    return (
      <p style={{ color: "var(--color-neutral-600)", fontSize: 13 }}>
        Not enough paired days to plot.
      </p>
    );
  }

  const xs = pairs.map((p) => p.x);
  const ys = pairs.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;

  const xFor = (v: number) => LEFT + ((v - xMin) / xSpan) * (RIGHT - LEFT);
  const yFor = (v: number) => BASELINE - ((v - yMin) / ySpan) * (BASELINE - TOP);

  const fit = linearRegression(xs, ys);

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const v = yMin + (ySpan * i) / 4;
    return { y: yFor(v), label: formatNumber(v) };
  });
  const xTicks = Array.from({ length: 5 }, (_, i) => {
    const v = xMin + (xSpan * i) / 4;
    return { x: xFor(v), label: formatNumber(v) };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={`Scatter plot of ${pairs.length} paired days`}
    >
      {yTicks.map((t) => (
        <g key={t.y}>
          <line
            x1={LEFT}
            x2={RIGHT}
            y1={t.y}
            y2={t.y}
            stroke="var(--color-neutral-300)"
            strokeWidth={1}
          />
          <text
            x={LEFT - 12}
            y={t.y + 4}
            textAnchor="end"
            fontSize={12}
            fill="var(--color-neutral-600)"
          >
            {t.label}
          </text>
        </g>
      ))}

      {xTicks.map((t) => (
        <text
          key={t.x}
          x={t.x}
          y={504}
          textAnchor="middle"
          fontSize={12}
          fill="var(--color-neutral-600)"
        >
          {t.label}
        </text>
      ))}

      {/* Only the two axes, no frame. */}
      <line
        x1={LEFT}
        y1={TOP}
        x2={LEFT}
        y2={BASELINE}
        stroke="var(--color-text)"
        strokeWidth={2}
      />
      <line
        x1={LEFT}
        y1={BASELINE}
        x2={RIGHT}
        y2={BASELINE}
        stroke="var(--color-text)"
        strokeWidth={2}
      />

      {pairs.map((p, i) => (
        <circle
          key={i}
          cx={xFor(p.x)}
          cy={yFor(p.y)}
          r={3.6}
          fill="var(--color-data-2)"
          fillOpacity={0.55}
        />
      ))}

      {fit ? (
        <line
          x1={xFor(xMin)}
          y1={yFor(fit.intercept + fit.slope * xMin)}
          x2={xFor(xMax)}
          y2={yFor(fit.intercept + fit.slope * xMax)}
          stroke="var(--color-data-5)"
          strokeWidth={2.5}
        />
      ) : null}
    </svg>
  );
}
