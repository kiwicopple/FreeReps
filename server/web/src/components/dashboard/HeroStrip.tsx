import { Skeleton } from "@/components/ui/skeleton";
import type { FrontPageMetric } from "../../api";
import Sparkline from "../Sparkline";
import SummaryValue, { SummaryGrid } from "../SummaryValue";
import { deltaColor } from "../../utils/metricDirection";
import { formatTimeAgo } from "../../utils/format";
import { sourceLabel } from "../../utils/sourceLabel";
import { displayDelta, displayValue } from "./metricDisplay";

export default function HeroStrip({
  metrics,
  loading,
}: {
  metrics: FrontPageMetric[];
  loading: boolean;
}) {
  const cells =
    loading && metrics.length === 0 ? [null, null, null, null] : metrics;
  return (
    <SummaryGrid>
      {cells.map((m, i) => (
        <SummaryValue
          key={m?.metric_name ?? i}
          label={m ? m.label || m.metric_name : "Loading"}
          value={m ? displayValue(m) : <Skeleton className="h-9 w-24" />}
          unit={m?.unit}
          status={
            m && (
              <span style={{ color: deltaColor(m.metric_name, m.delta_7d) }}>
                {displayDelta(m)}
              </span>
            )
          }
          detail={
            m &&
            (m.source
              ? sourceLabel(m.source)
              : m.time
                ? formatTimeAgo(m.time)
                : "")
          }
          sparkline={
            <Sparkline
              values={m?.series ?? []}
              width={260}
              height={28}
              stroke="var(--color-data-3)"
              strokeWidth={1.6}
            />
          }
        />
      ))}
    </SummaryGrid>
  );
}
