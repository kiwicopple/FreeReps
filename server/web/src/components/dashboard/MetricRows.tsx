import { Button } from "../ui/button";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { FrontPageMetric } from "../../api";
import Sparkline from "../Sparkline";
import { deltaColor } from "../../utils/metricDirection";
import { formatTimeAgo } from "../../utils/format";
import { sourceLabel } from "../../utils/sourceLabel";
import {
  displayDelta,
  displayValue,
  type MetricGroupSection,
} from "./metricDisplay";

interface Props {
  groups: MetricGroupSection[];
  loading: boolean;
  onSelect: (metric: FrontPageMetric, trigger: HTMLElement) => void;
}

/**
 * What the metrics table becomes below 768px: identity left, a short sparkline
 * in the middle, value and delta right. The sparkline stays because it is
 * inline SVG and costs nothing.
 */
export default function MetricRows({ groups, loading, onSelect }: Props) {
  if (loading && groups.length === 0) {
    return (
      <div style={{ borderTop: "1px solid var(--border)" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="row">
            <div className="flex-1">
              <Skeleton style={{ width: 120, height: 14 }} />
            </div>
            <Skeleton style={{ width: 60, height: 14 }} />
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <Empty
        className="page-x"
        style={{ color: "var(--muted-foreground)", fontSize: 13 }}
      >
        No metrics selected. Pick which metrics the list shows in Settings.
      </Empty>
    );
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      {groups.map((group) => (
        <div key={group.category}>
          <div className="kick row-group">{group.label}</div>
          {group.metrics.map((m) => (
            <MetricRow key={m.metric_name} metric={m} onSelect={onSelect} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MetricRow({
  metric: m,
  onSelect,
}: {
  metric: FrontPageMetric;
  onSelect: Props["onSelect"];
}) {
  const meta = [sourceLabel(m.source), m.time ? formatTimeAgo(m.time) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Button
      variant="ghost"
      className="row h-auto w-full justify-between rounded-none whitespace-normal text-left"
      aria-label={`View ${m.label} details`}
      onClick={(event) => onSelect(m, event.currentTarget)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "500 14px var(--font-body)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {m.label || m.metric_name}
        </div>
        <div
          style={{
            font: "400 11px var(--font-body)",
            color: "var(--muted-foreground)",
            marginTop: 3,
          }}
        >
          {meta || "no readings"}
        </div>
      </div>

      <Sparkline
        values={m.series}
        width={90}
        height={20}
        cssWidth={72}
        stroke="var(--muted-foreground)"
        strokeWidth={1.4}
      />

      <div style={{ textAlign: "right", flex: "none", width: 82 }}>
        <div className="num" style={{ font: "700 15px var(--font-body)" }}>
          {displayValue(m)}{" "}
          <span
            style={{
              fontWeight: 400,
              fontSize: 11,
              color: "var(--muted-foreground)",
            }}
          >
            {m.unit}
          </span>
        </div>
        <div
          className="num"
          style={{
            font: "600 11px var(--font-body)",
            marginTop: 3,
            color: deltaColor(m.metric_name, m.delta_7d),
          }}
        >
          {displayDelta(m)}
        </div>
      </div>
    </Button>
  );
}
