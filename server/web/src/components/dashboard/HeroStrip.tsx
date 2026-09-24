import { Skeleton } from "@/components/ui/skeleton";
import type { FrontPageMetric } from "../../api";
import Sparkline from "../Sparkline";
import { SummaryContent, SummaryGrid } from "../SummaryValue";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { ChevronRight } from "lucide-react";
import { deltaColor } from "../../utils/metricDirection";
import { formatTimeAgo } from "../../utils/format";
import { sourceLabel } from "../../utils/sourceLabel";
import { displayDelta, displayValue } from "./metricDisplay";

export default function HeroStrip({
  metrics,
  loading,
  onSelect,
}: {
  metrics: FrontPageMetric[];
  loading: boolean;
  onSelect: (metric: FrontPageMetric, trigger: HTMLElement) => void;
}) {
  const cells =
    loading && metrics.length === 0 ? [null, null, null, null] : metrics;
  return (
    <SummaryGrid>
      {cells.map((m, i) => (
        <Card
          key={m?.metric_name ?? i}
          className="summary-card"
          render={
            m ? (
              <Button
                variant="ghost"
                className="h-auto w-full whitespace-normal text-left"
                aria-label={`View ${m.label} details`}
                onClick={(event) => onSelect(m, event.currentTarget)}
              />
            ) : undefined
          }
        >
          {m && (
            <ChevronRight
              aria-hidden
              className="absolute right-4 top-4 size-4 text-muted-foreground md:right-5 md:top-5"
            />
          )}
          <SummaryContent
            label={
              m ? (
                <span className="block pr-5">{m.label || m.metric_name}</span>
              ) : (
                "Loading"
              )
            }
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
        </Card>
      ))}
    </SummaryGrid>
  );
}
