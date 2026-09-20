import type { FrontPageMetric } from "../../api";
import Sparkline from "../Sparkline";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { deltaColor } from "../../utils/metricDirection";
import { formatTimeAgo } from "../../utils/format";
import { sourceLabel } from "../../utils/sourceLabel";
import { displayDelta, displayValue } from "./metricDisplay";

interface Props {
  metrics: FrontPageMetric[];
  loading: boolean;
}

/**
 * Four numbers between 2px rules — 4-up on desktop, 2×2 on the phone. Each cell
 * carries a label, the value, a delta and meta line, and a sparkline.
 *
 * All four sparklines take the same data colour. One of them used to be drawn
 * in the brand token as the metric to watch, which put that line directly under
 * a delta figure in the same blue whenever the metric had improved, so the two
 * read as one statement. The cell is labelled; the emphasis carried nothing the
 * label does not.
 */
export default function HeroStrip({ metrics, loading }: Props) {
  const isDesktop = useIsDesktop();
  const cells = loading && metrics.length === 0 ? [null, null, null, null] : metrics;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "1fr 1fr",
        borderTop: "2px solid var(--color-text)",
        borderBottom: "2px solid var(--color-text)",
      }}
    >
      {cells.map((m, i) => (
        <HeroCell key={m?.metric_name ?? i} metric={m} isDesktop={isDesktop} />
      ))}
    </div>
  );
}

function HeroCell({
  metric: m,
  isDesktop,
}: {
  metric: FrontPageMetric | null;
  isDesktop: boolean;
}) {
  return (
    <div
      style={{
        /* Vertical only: the padding shorthand would override the page-x
           class's padding-inline and pull the cell to the page edge. */
        paddingTop: isDesktop ? 24 : 16,
        paddingBottom: isDesktop ? 22 : 16,
        borderRight: "1px solid var(--color-divider)",
        /* On the 2×2 grid the first row needs its own rule. */
        borderBottom: isDesktop ? undefined : "1px solid var(--color-divider)",
      }}
      className="page-x"
    >
      <div className="kick">{m ? m.label || m.metric_name : " "}</div>

      <div
        className="num"
        style={{
          font: `800 ${isDesktop ? 56 : 40}px/1 var(--font-heading)`,
          letterSpacing: "-0.035em",
          marginTop: isDesktop ? 14 : 10,
        }}
      >
        {m ? (
          <>
            {displayValue(m)}
            <span
              style={{
                font: `500 ${isDesktop ? 15 : 12}px var(--font-body)`,
                color: "var(--color-neutral-600)",
                marginLeft: isDesktop ? 6 : 4,
              }}
            >
              {m.unit}
            </span>
          </>
        ) : (
          <span
            className="skel"
            style={{ width: isDesktop ? 120 : 90, height: isDesktop ? 48 : 34 }}
          />
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: isDesktop ? 10 : 8,
          marginTop: isDesktop ? 12 : 8,
        }}
      >
        {m ? (
          <>
            <span
              className="num"
              style={{
                font: `600 ${isDesktop ? 12 : 11.5}px var(--font-body)`,
                color: deltaColor(m.metric_name, m.delta_7d),
              }}
            >
              {displayDelta(m)}
            </span>
            <span
              style={{
                font: `400 ${isDesktop ? 12 : 11}px var(--font-body)`,
                color: "var(--color-neutral-600)",
              }}
            >
              {m.source ? sourceLabel(m.source) : m.time ? formatTimeAgo(m.time) : ""}
            </span>
          </>
        ) : (
          <span className="skel" style={{ width: 80, height: 12 }} />
        )}
      </div>

      <div style={{ marginTop: isDesktop ? 18 : 10 }}>
        <Sparkline
          values={m?.series ?? []}
          width={isDesktop ? 260 : 160}
          height={isDesktop ? 34 : 24}
          stroke="var(--color-data-3)"
          strokeWidth={1.6}
        />
      </div>
    </div>
  );
}
