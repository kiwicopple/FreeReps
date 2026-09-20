import { useMemo } from "react";
import type { SleepSession, SleepStage } from "../../api";
import { stageColor } from "../../utils/stageColors";

/* The Y axis is clock time, not duration: 22:00 at the top through 09:00 at
   the bottom, so bedtime drift and wake-time drift are both visible. Hours are
   counted from midday so an evening bedtime and a morning wake sit on one
   continuous scale. */
const AXIS_START = 22;
const AXIS_END = 33; // 09:00 the next day
const PLOT_HEIGHT = 300;
const HOUR_GUTTER = 46;

interface Props {
  sessions: SleepSession[];
  stages: SleepStage[];
}

export default function NightsChart({ sessions, stages }: Props) {
  const nights = useMemo(
    () => buildNights(sessions, stages),
    [sessions, stages],
  );

  if (nights.length === 0) {
    return (
      <p style={{ color: "var(--color-neutral-600)", fontSize: 13 }}>
        No nights in this window.
      </p>
    );
  }

  const hourLines: number[] = [];
  for (let h = AXIS_START; h <= AXIS_END; h += 2) hourLines.push(h);

  return (
    <div style={{ display: "flex" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ position: "relative", height: PLOT_HEIGHT }}>
          {hourLines.map((h) => (
            <div
              key={h}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: yFor(h),
                height: 1,
                background: "var(--color-neutral-300)",
              }}
            />
          ))}

          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "stretch",
            }}
          >
            {nights.map((night) => (
              <div
                key={night.key}
                style={{ flex: 1, position: "relative" }}
                title={night.title}
              >
                {night.blocks.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: "22%",
                      right: "22%",
                      top: b.top,
                      height: b.height,
                      background: b.color,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 6 }}>
          {nights.map((night, i) => (
            <div
              key={night.key}
              style={{
                flex: 1,
                textAlign: "center",
                font: "400 10px var(--font-body)",
                color: "var(--color-neutral-600)",
                whiteSpace: "nowrap",
              }}
            >
              {i % 3 === 0 ? night.label : ""}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          width: HOUR_GUTTER,
          flex: "none",
          position: "relative",
          height: PLOT_HEIGHT,
        }}
      >
        {hourLines.map((h) => (
          <span
            key={h}
            className="num"
            style={{
              position: "absolute",
              left: 8,
              top: yFor(h) - 7,
              font: "400 11px var(--font-body)",
              color: "var(--color-neutral-600)",
            }}
          >
            {String(h % 24).padStart(2, "0")}:00
          </span>
        ))}
      </div>
    </div>
  );
}

function yFor(hour: number): number {
  return ((hour - AXIS_START) / (AXIS_END - AXIS_START)) * PLOT_HEIGHT;
}

/** Hours since midday, so an evening bedtime and a morning wake are ordered. */
function axisHour(d: Date): number {
  const h = d.getHours() + d.getMinutes() / 60;
  return h < 12 ? h + 24 : h;
}

interface Night {
  key: string;
  label: string;
  title: string;
  blocks: { top: number; height: number; color: string }[];
}

function buildNights(
  sessions: SleepSession[],
  stages: SleepStage[],
): Night[] {
  const ordered = [...sessions].sort(
    (a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime(),
  );

  return ordered.map((session) => {
    const from = new Date(session.SleepStart).getTime();
    const to = new Date(session.SleepEnd).getTime();
    const nightStages = stages.filter((s) => {
      const t = new Date(s.StartTime).getTime();
      return t >= from && t < to;
    });

    const blocks = nightStages
      .map((s) => {
        const top = yFor(axisHour(new Date(s.StartTime)));
        const bottom = yFor(axisHour(new Date(s.EndTime)));
        return {
          top,
          // Minimum height so a two-minute awakening still renders. 3px
          // rather than the 1.35px this was: Awake sits at the light end of
          // the data ramp, where 2.4:1 against the ground does not carry a
          // hairline.
          height: Math.max(bottom - top, PLOT_HEIGHT * 0.01),
          color: stageColor(s.Stage),
        };
      })
      .filter((b) => b.top >= 0 && b.top <= PLOT_HEIGHT);

    const date = new Date(session.Date);
    return {
      key: session.Date,
      label: date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
      title: `${date.toLocaleDateString("en-GB")} · ${session.TotalSleep.toFixed(1)} h`,
      blocks,
    };
  });
}
