import { Empty } from "@/components/ui/empty";
import { formatHoursMinutes } from "../../utils/format";
import { STAGE_COMPOSITION_ORDER, stageColor } from "../../utils/stageColors";

export interface StageTotals {
  Deep: number;
  Core: number;
  REM: number;
  Awake: number;
}

interface Props {
  /** Hours per stage. */
  totals: StageTotals;
  compact?: boolean;
}

/**
 * One bar divided by stage proportion, with the durations spelled out below.
 * It replaces a legend the reader had to mentally add up.
 */
export default function StageComposition({ totals, compact = false }: Props) {
  const sum = STAGE_COMPOSITION_ORDER.reduce((a, s) => a + (totals[s] || 0), 0);
  if (sum <= 0) {
    return (
      <Empty style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
        No stage breakdown for this night.
      </Empty>
    );
  }

  const segments = STAGE_COMPOSITION_ORDER.map((stage) => ({
    stage,
    hours: totals[stage] || 0,
    pct: ((totals[stage] || 0) / sum) * 100,
  })).filter((s) => s.pct > 0);

  return (
    <div>
      <div
        style={{
          display: "flex",
          height: compact ? 16 : 36,
          border: compact ? undefined : "1px solid var(--border)",
          gap: 1,
          background: "var(--background)",
        }}
      >
        {segments.map((s) => (
          <div
            key={s.stage}
            style={{ flex: s.pct, background: stageColor(s.stage) }}
            title={`${s.stage} ${formatHoursMinutes(s.hours)}`}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: compact ? undefined : 32,
          justifyContent: compact ? "space-between" : "flex-start",
          marginTop: compact ? 8 : 14,
          flexWrap: "wrap",
        }}
      >
        {segments.map((s) => (
          <div
            key={s.stage}
            style={{
              display: "flex",
              alignItems: compact ? "flex-start" : "center",
              flexDirection: compact ? "column" : "row",
              gap: compact ? 4 : 9,
            }}
          >
            {compact ? (
              <span className="kick" style={{ fontSize: 9 }}>
                {s.stage}
              </span>
            ) : (
              <>
                <span
                  style={{
                    width: 11,
                    height: 11,
                    background: stageColor(s.stage),
                    flex: "none",
                  }}
                />
                <span
                  style={{
                    font: "500 12.5px var(--font-body)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  {s.stage}
                </span>
              </>
            )}
            <span
              className="num"
              style={{ font: `700 ${compact ? 13 : 12.5}px var(--font-body)` }}
            >
              {compact ? `${s.pct.toFixed(0)}%` : formatHoursMinutes(s.hours)}{" "}
              <span
                style={{
                  fontWeight: 400,
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                }}
              >
                {compact ? formatHoursMinutes(s.hours) : `${s.pct.toFixed(0)}%`}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
