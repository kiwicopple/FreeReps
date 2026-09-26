import { dateOnlyToLocalDate } from "../../utils/localDate";
import { Empty } from "@/components/ui/empty";
import { useMemo } from "react";
import type { SleepSession, SleepStage } from "../../api";
import { stageColor } from "../../utils/stageColors";

/* Start with the usual overnight window, expanding it for daytime sleep and
   earlier records viewed after travel. Hours run from noon through the next day. */
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
      <Empty style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
        No nights in this window.
      </Empty>
    );
  }

  const blocks = nights.flatMap((n) => n.blocks);
  const axisStart =
    Math.floor(Math.min(22, ...blocks.map((b) => b.start)) / 2) * 2;
  const axisEnd = Math.ceil(Math.max(33, ...blocks.map((b) => b.end)) / 2) * 2;
  const yFor = (hour: number) =>
    ((hour - axisStart) / (axisEnd - axisStart)) * PLOT_HEIGHT;
  const hourLines: number[] = [];
  for (let h = axisStart; h <= axisEnd; h += axisEnd - axisStart > 20 ? 4 : 2)
    hourLines.push(h);

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
                background: "var(--border)",
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
                      top: yFor(b.start),
                      height: Math.min(
                        PLOT_HEIGHT - yFor(b.start),
                        Math.max(
                          yFor(b.end) - yFor(b.start),
                          PLOT_HEIGHT * 0.01,
                        ),
                      ),
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
                color: "var(--muted-foreground)",
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
              color: "var(--muted-foreground)",
            }}
          >
            {String(h % 24).padStart(2, "0")}:00
          </span>
        ))}
      </div>
    </div>
  );
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
  blocks: { start: number; end: number; color: string }[];
}

function buildNights(sessions: SleepSession[], stages: SleepStage[]): Night[] {
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

    const blocks = nightStages.map((s) => {
      const from = new Date(s.StartTime),
        to = new Date(s.EndTime);
      const start = axisHour(from);
      let end = axisHour(to);
      if (end <= start) {
        // Crossing noon wraps the clock axis. A repeated DST hour is only its
        // actual duration, not an extra 24 hours on the history chart.
        end =
          from.getHours() < 12 && to.getHours() >= 12
            ? end + 24
            : start + (to.getTime() - from.getTime()) / 3_600_000;
      }
      return { start, end, color: stageColor(s.Stage) };
    });

    const date = dateOnlyToLocalDate(session.Date);
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
