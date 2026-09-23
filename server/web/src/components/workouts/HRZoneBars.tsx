import PageSection from "../PageSection";
import { Empty } from "@/components/ui/empty";
import type { WorkoutHR } from "../../api";
import { ZONE_BOUNDS, ZONE_COLORS, zoneBands } from "../../utils/stageColors";

interface Props {
  hrData: WorkoutHR[];
  /** Falls back to the session's own peak when the user's maximum is unknown. */
  maxHR?: number;
}

/**
 * Time in each zone, measured from the gaps between samples rather than by
 * counting them — a strength session's rest periods would otherwise inflate
 * the low zones.
 */
export default function HRZoneBars({ hrData, maxHR }: Props) {
  if (!hrData || hrData.length < 5) {
    return (
      <PageSection title="Time in heart rate zones">
        <Empty
          style={{ color: "var(--muted-foreground)", fontSize: 13, margin: 0 }}
        >
          Not enough heart rate data for zone analysis.
        </Empty>
      </PageSection>
    );
  }

  const peak = Math.max(
    ...hrData.map((d) => d.MaxBPM ?? d.AvgBPM ?? 0),
    maxHR ?? 0,
  );
  if (peak <= 0) return null;

  const edges = ZONE_BOUNDS.map((f) => f * peak);
  const zoneSecs: number[] = new Array(ZONE_COLORS.length).fill(0);

  for (let i = 1; i < hrData.length; i++) {
    const bpm = hrData[i].AvgBPM ?? hrData[i].MaxBPM ?? 0;
    if (!bpm) continue;
    const dt =
      (new Date(hrData[i].Time).getTime() -
        new Date(hrData[i - 1].Time).getTime()) /
      1000;
    // Skip gaps over ten minutes: those are rests, not time in a zone.
    if (dt <= 0 || dt > 600) continue;
    let zone = edges.length;
    for (let z = 0; z < edges.length; z++) {
      if (bpm < edges[z]) {
        zone = z;
        break;
      }
    }
    zoneSecs[zone] += dt;
  }

  const total = zoneSecs.reduce((a, b) => a + b, 0);
  if (total === 0) {
    return (
      <PageSection title="Time in heart rate zones">
        <p
          style={{ color: "var(--muted-foreground)", fontSize: 13, margin: 0 }}
        >
          Samples are too sparse to measure time in zones.
        </p>
      </PageSection>
    );
  }

  const bands = zoneBands(peak);

  return (
    <PageSection title="Time in heart rate zones">
      {zoneSecs.map((secs, i) => {
        const pct = (secs / total) * 100;
        const mins = Math.round(secs / 60);
        if (mins === 0 && pct < 1) return null;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "7px 0",
            }}
          >
            <span className="kick" style={{ width: 52, flex: "none" }}>
              Zone {i + 1}
            </span>
            <span
              className="num"
              style={{
                width: 70,
                flex: "none",
                font: "400 11.5px var(--font-body)",
                color: "var(--muted-foreground)",
              }}
            >
              {bands[i]}
            </span>
            <div
              style={{
                flex: 1,
                height: 14,
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: `${Math.max(pct, 1)}%`,
                  height: "100%",
                  background: ZONE_COLORS[i],
                }}
              />
            </div>
            <span
              className="num"
              style={{
                width: 84,
                flex: "none",
                textAlign: "right",
                font: "500 12.5px var(--font-body)",
              }}
            >
              {mins}m
              <span
                style={{ color: "var(--muted-foreground)", fontWeight: 400 }}
              >
                {" "}
                {Math.round(pct)}%
              </span>
            </span>
          </div>
        );
      })}
    </PageSection>
  );
}
