import type { SleepStage } from "../../api";
import { STAGE_LANES, stageColor } from "../../utils/stageColors";

const LANE_HEIGHT = 44;
const BLOCK_HEIGHT = 26;
const LABEL_GUTTER = 52;

interface Props {
  stages: SleepStage[];
  /** The phone gets four 10px rows in a 108px SVG, without lane labels. */
  compact?: boolean;
}

/**
 * Stage blocks positioned as percentages of the night, one lane per stage.
 * Awake is the accent, so awakenings are the one thing that pops out of the
 * plot.
 */
export default function Hypnogram({ stages, compact = false }: Props) {
  if (stages.length === 0) {
    return (
      <p style={{ color: "var(--color-neutral-600)", fontSize: 13 }}>
        No stage data for this night.
      </p>
    );
  }

  // The axis still spans everything the night carries, "In Bed" included, so
  // the plot starts at bedtime and ends at wake-up the way the ring reports it.
  const startMs = Math.min(
    ...stages.map((s) => new Date(s.StartTime).getTime()),
  );
  const endMs = Math.max(...stages.map((s) => new Date(s.EndTime).getTime()));
  const totalMs = endMs - startMs;
  if (totalMs <= 0) return null;

  // Only the four sleep stages get drawn. Apple Health also reports an "In Bed"
  // sample covering the whole night, and the lane index used to fall back to 0
  // for anything it did not recognise — so that one block was painted across
  // the Awake lane, on top of every awakening recorded before it. The first
  // one, at bedtime, disappeared underneath it.
  const blocks = stages.flatMap((s, i) => {
    const laneIndex = STAGE_LANES.indexOf(
      s.Stage as (typeof STAGE_LANES)[number],
    );
    if (laneIndex < 0) return [];

    const from = new Date(s.StartTime).getTime();
    const to = new Date(s.EndTime).getTime();
    return [
      {
        key: `${s.StartTime}-${i}`,
        left: ((from - startMs) / totalMs) * 100,
        // A two-minute awakening still has to render.
        width: Math.max(((to - from) / totalMs) * 100, 0.45),
        laneIndex,
        color: stageColor(s.Stage),
        title: s.Stage,
      },
    ];
  });

  if (compact) {
    const rowHeight = 10;
    const gap = 16;
    const height = (STAGE_LANES.length - 1) * gap + rowHeight;
    return (
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: 108, display: "block" }}
        role="img"
        aria-label="Sleep stages through the night"
      >
        {blocks.map((b) => (
          <rect
            key={b.key}
            x={b.left}
            y={b.laneIndex * gap}
            width={b.width}
            height={rowHeight}
            fill={b.color}
          />
        ))}
      </svg>
    );
  }

  return (
    <div style={{ display: "flex" }}>
      <div style={{ width: LABEL_GUTTER, flex: "none" }}>
        {STAGE_LANES.map((lane) => (
          <div
            key={lane}
            style={{
              height: LANE_HEIGHT,
              display: "flex",
              alignItems: "center",
              font: "400 11px var(--font-body)",
              color: "var(--color-neutral-600)",
            }}
          >
            {lane}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "relative",
          flex: 1,
          height: STAGE_LANES.length * LANE_HEIGHT,
        }}
      >
        {STAGE_LANES.map((lane, i) => (
          <div
            key={lane}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: (i + 1) * LANE_HEIGHT - 1,
              height: 1,
              background: "var(--color-neutral-300)",
            }}
          />
        ))}
        {blocks.map((b) => (
          <div
            key={b.key}
            title={b.title}
            style={{
              position: "absolute",
              left: `${b.left}%`,
              width: `${b.width}%`,
              top: b.laneIndex * LANE_HEIGHT + (LANE_HEIGHT - BLOCK_HEIGHT) / 2,
              height: BLOCK_HEIGHT,
              background: b.color,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Hour ticks under the plot, at their position in the night. */
export function hourTicks(
  stages: SleepStage[],
): { label: string; pct: number }[] {
  if (stages.length === 0) return [];
  const startMs = Math.min(
    ...stages.map((s) => new Date(s.StartTime).getTime()),
  );
  const endMs = Math.max(...stages.map((s) => new Date(s.EndTime).getTime()));
  const totalMs = endMs - startMs;
  if (totalMs <= 0) return [];

  const step = totalMs / 3600000 > 10 ? 2 : 1;
  const first = new Date(startMs);
  first.setMinutes(0, 0, 0);
  first.setTime(first.getTime() + 3600000);

  const ticks: { label: string; pct: number }[] = [];
  for (let t = first.getTime(); t < endMs; t += step * 3600000) {
    const pct = ((t - startMs) / totalMs) * 100;
    if (pct > 2 && pct < 98) {
      ticks.push({
        label: `${String(new Date(t).getHours()).padStart(2, "0")}:00`,
        pct,
      });
    }
  }
  return ticks;
}
