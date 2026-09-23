import { Empty } from "@/components/ui/empty";
import { Alert } from "@/components/ui/alert";
import DateControl from "@/components/DateControl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import RecoveryScore from "../components/sleep/RecoveryScore";
import { localToday, shiftDate, validDate } from "../utils/nutrition";
import SleepHeartRate from "../components/sleep/SleepHeartRate";
import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchSleep, type SleepSession, type SleepStage } from "../api";
import PageHeader from "../components/PageHeader";
import RangeControl from "../components/RangeControl";
import NightsChart from "../components/sleep/NightsChart";
import StageComposition, {
  type StageTotals,
} from "../components/sleep/StageComposition";
import { useIsDesktop } from "../hooks/useMediaQuery";
import {
  formatClock,
  formatDayMonth,
  formatHoursMinutes,
} from "../utils/format";
import { stageColor } from "../utils/stageColors";
import { queryMessage, queryState } from "../utils/queryState";

const RANGES = ["7d", "30d", "90d"] as const;
type Range = (typeof RANGES)[number];

const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };

export default function SleepPage() {
  const isDesktop = useIsDesktop();
  const [params, setParams] = useSearchParams();
  const rawRange = params.get("range");
  const range: Range = RANGES.includes(rawRange as Range) ? rawRange as Range : "30d";
  const rawDate = params.get("date");
  const selectedDate = validDate(rawDate) ? rawDate : null;
  const today = localToday();
  const endISO = selectedDate ?? today;
  const startISO = shiftDate(endISO, 1 - RANGE_DAYS[range]);

  const query = useQuery({
    queryKey: ["sleep", startISO, endISO],
    queryFn: () => fetchSleep(startISO, endISO),
  });
  const state = queryState(query);
  const message = queryMessage(state, query.error);

  const sessions = query.data?.sessions ?? [];
  const stages = query.data?.stages ?? [];

  // Session dates identify the night, rather than the following wake-up day.
  const last = selectedDate
    ? sessions.find((s) => s.Date.slice(0, 10) === selectedDate) ?? null
    : sessions[0] ?? null;
  const date = selectedDate ?? last?.Date.slice(0, 10) ?? today;
  const navigateDate = (next: string | null) => {
    const p = new URLSearchParams(params);
    if (next) p.set("date", next);
    else p.delete("date");
    setParams(p);
  };

  const lastNightStages = useMemo(
    () => (last ? stagesForSession(stages, last) : []),
    [stages, last],
  );

  const totals = useMemo(() => stageTotals(lastNightStages), [lastNightStages]);

  const setRange = (next: Range) => {
    const p = new URLSearchParams(params);
    p.set("range", next);
    setParams(p, { replace: true });
  };

  const averageHours =
    sessions.length > 0
      ? sessions.reduce((a, s) => a + s.TotalSleep, 0) / sessions.length
      : null;

  const awakenings = lastNightStages.filter((s) => s.Stage === "Awake").length;

  return (
    <>
      <PageHeader
        kicker={
          last
            ? `Night of ${new Date(last.Date).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}`
            : "No sleep recorded"
        }
        title="Sleep"
        actions={
          <RangeControl
            options={RANGES}
            value={range}
            onChange={setRange}
            name="sleep-range"
          />
        }
      />

      <div className="page-x" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, paddingBottom: 20 }}>
        <Button variant="outline" aria-label="Previous night" onClick={() => navigateDate(shiftDate(date, -1))} style={{ minWidth: 44, minHeight: 44 }}>←</Button>
        <DateControl aria-label="Night date"  value={date} max={today} onValueChange={(value) => {
          if (validDate(value) && value <= today) navigateDate(value);
        }}  />
        <Button variant="outline" aria-label="Next night" disabled={date >= today} onClick={() => navigateDate(shiftDate(date, 1))} style={{ minWidth: 44, minHeight: 44 }}>→</Button>
        <Button variant="outline" onClick={() => navigateDate(null)} style={{ minHeight: 44 }}>Latest</Button>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)", flexBasis: "100%" }}>Choose the date the night is recorded under.</span>
      </div>

      {last && <RecoveryScore session={last} />}

      {message ? (
        <Alert variant="error"
          className="page-x"
          style={{ color: "var(--muted-foreground)", fontSize: 13 }}
        >
          {message}
        </Alert>
      ) : state === "loading" ? (
        <div
          className="page-x"
          style={{ borderTop: "2px solid var(--foreground)", paddingTop: 24 }}
        >
          <Skeleton  style={{ width: 180, height: 44 }} />
        </div>
      ) : !last ? (
        <Empty
          className="page-x"
          style={{ color: "var(--muted-foreground)", fontSize: 13 }}
        >
          No sleep recorded for this date. Choose another night or return to Latest.
        </Empty>
      ) : isDesktop ? (
        <DesktopSleep
          session={last}
          stages={lastNightStages}
          totals={totals}
          sessions={sessions}
          allStages={stages}
          averageHours={averageHours}
          awakenings={awakenings}
        />
      ) : (
        <MobileSleep
          session={last}
          stages={lastNightStages}
          totals={totals}
          sessions={sessions}
        />
      )}
    </>
  );
}

function DesktopSleep({
  session,
  stages,
  totals,
  sessions,
  allStages,
  averageHours,
  awakenings,
}: {
  session: SleepSession;
  stages: SleepStage[];
  totals: StageTotals;
  sessions: SleepSession[];
  allStages: SleepStage[];
  averageHours: number | null;
  awakenings: number;
}) {
  const efficiency =
    session.InBed > 0 ? (session.Asleep / session.InBed) * 100 : null;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          borderTop: "2px solid var(--foreground)",
          borderBottom: "2px solid var(--foreground)",
        }}
      >
        <HeroCell
          label="Total sleep"
          value={formatHoursMinutes(session.TotalSleep)}
          meta={
            averageHours != null
              ? `${formatHoursMinutes(averageHours)} on average`
              : ""
          }
        />
        <HeroCell
          label="Time in bed"
          value={formatHoursMinutes(session.InBed)}
          meta={`${formatClock(session.InBedStart)} → ${formatClock(session.InBedEnd)}`}
        />
        <HeroCell
          label="Efficiency"
          value={efficiency != null ? `${efficiency.toFixed(0)}%` : "—"}
          meta={`${formatHoursMinutes(totals.Awake)} awake`}
        />
        <HeroCell
          label="Deep"
          value={formatHoursMinutes(totals.Deep)}
          meta={pctOf(totals.Deep, session.TotalSleep)}
        />
        <HeroCell
          label="REM"
          value={formatHoursMinutes(totals.REM)}
          meta={pctOf(totals.REM, session.TotalSleep)}
        />
      </div>

      <Section title="Stage composition">
        <StageComposition totals={totals} />
      </Section>

      <Section
        title="Hypnogram"
        aside={`${formatClock(session.SleepStart)} → ${formatClock(session.SleepEnd)} · ${awakenings} awakening${awakenings === 1 ? "" : "s"}`}
      >
        <SleepHeartRate stages={stages} />

      </Section>

      <Section
        title={`Last ${sessions.length} nights`}
        aside={
          averageHours != null ? (
            <>
              {formatDayMonth(new Date(sessions[sessions.length - 1].Date))} –{" "}
              {formatDayMonth(new Date(sessions[0].Date))} · average{" "}
              <span style={{ fontWeight: 700, color: "var(--foreground)" }}>
                {formatHoursMinutes(averageHours)}
              </span>
            </>
          ) : null
        }
      >
        <NightsChart sessions={sessions} stages={allStages} />
      </Section>
    </>
  );
}

function MobileSleep({
  session,
  stages,
  totals,
  sessions,
}: {
  session: SleepSession;
  stages: SleepStage[];
  totals: StageTotals;
  sessions: SleepSession[];
}) {
  const efficiency =
    session.InBed > 0 ? (session.Asleep / session.InBed) * 100 : null;
  const latency =
    (new Date(session.SleepStart).getTime() -
      new Date(session.InBedStart).getTime()) /
    60000;

  return (
    <>
      <div className="page-x" style={{ paddingBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span
            className="num"
            style={{
              font: "800 44px/1 var(--font-heading)",
              letterSpacing: "-0.035em",
            }}
          >
            {formatHoursMinutes(session.TotalSleep)}
          </span>
          <span
            style={{
              font: "500 13px var(--font-body)",
              color: "var(--muted-foreground)",
            }}
          >
            in bed {formatHoursMinutes(session.InBed)}
            {efficiency != null ? ` · ${efficiency.toFixed(0)}% eff.` : ""}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          borderTop: "2px solid var(--foreground)",
          borderBottom: "2px solid var(--foreground)",
        }}
      >
        <MobileStat label="Deep" value={formatHoursMinutes(totals.Deep)} />
        <MobileStat
          label="Efficiency"
          value={efficiency != null ? `${efficiency.toFixed(0)}%` : "—"}
        />
        <MobileStat
          label="Latency"
          value={latency > 0 ? `${Math.round(latency)}m` : "—"}
        />
      </div>

      <div className="kick page-x" style={{ paddingTop: 16, paddingBottom: 6 }}>
        Hypnogram · {formatClock(session.SleepStart)} →{" "}
        {formatClock(session.SleepEnd)}
      </div>
      <div className="page-x" style={{ paddingBottom: 14 }}>
        <SleepHeartRate stages={stages} compact />
      </div>

      <div className="page-x" style={{ paddingBottom: 16 }}>
        <StageComposition totals={totals} compact />
      </div>

      <div
        className="kick page-x"
        style={{
          borderTop: "2px solid var(--foreground)",
          paddingTop: 12,
          paddingBottom: 6,
        }}
      >
        Last {Math.min(sessions.length, 10)} nights
      </div>
      <div>
        {sessions.slice(0, 10).map((s) => (
          <NightRow key={s.Date} session={s} />
        ))}
      </div>
    </>
  );
}

function NightRow({ session }: { session: SleepSession }) {
  const segments = (
    [
      ["Deep", session.Deep],
      ["REM", session.REM],
      ["Core", session.Core],
    ] as const
  ).filter(([, v]) => v > 0);
  const total = segments.reduce((a, [, v]) => a + v, 0) || 1;

  return (
    <div className="row" style={{ paddingTop: 10, paddingBottom: 10 }}>
      <span style={{ font: "500 13px var(--font-body)", width: 44, flex: "none" }}>
        {new Date(session.Date).toLocaleDateString("en-GB", {
          weekday: "short",
        })}
      </span>
      <div style={{ flex: 1, display: "flex", height: 12 }}>
        {segments.map(([stage, value]) => (
          <div
            key={stage}
            style={{ flex: value / total, background: stageColor(stage) }}
          />
        ))}
      </div>
      <span
        className="num"
        style={{
          font: "600 13px var(--font-body)",
          width: 46,
          textAlign: "right",
          flex: "none",
        }}
      >
        {formatHoursMinutes(session.TotalSleep)}
      </span>
    </div>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ borderTop: "2px solid var(--foreground)", marginTop: 26 }}>
      <div
        className="flex items-baseline justify-between gap-5 page-x"
        style={{ paddingTop: 20, paddingBottom: 16 }}
      >
        <h2 style={{ fontSize: 19, fontWeight: 700 }}>{title}</h2>
        {aside ? (
          <span
            style={{
              font: "400 12px var(--font-body)",
              color: "var(--muted-foreground)",
            }}
          >
            {aside}
          </span>
        ) : null}
      </div>
      <div className="page-x" style={{ paddingBottom: 30 }}>
        {children}
      </div>
    </div>
  );
}

function HeroCell({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div
      className="page-x"
      style={{
        paddingTop: 24,
        paddingBottom: 22,
        borderRight: "1px solid var(--border)",
      }}
    >
      <div className="kick">{label}</div>
      <div
        className="num"
        style={{
          font: "800 44px/1 var(--font-heading)",
          letterSpacing: "-0.035em",
          marginTop: 14,
        }}
      >
        {value}
      </div>
      <div
        style={{
          font: "400 12px var(--font-body)",
          color: "var(--muted-foreground)",
          marginTop: 12,
        }}
      >
        {meta}
      </div>
    </div>
  );
}

function MobileStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="page-x"
      style={{
        paddingTop: 12,
        paddingBottom: 12,
        borderRight: "1px solid var(--border)",
      }}
    >
      <div className="kick">{label}</div>
      <div
        className="num"
        style={{
          font: "700 22px/1 var(--font-heading)",
          letterSpacing: "-0.02em",
          marginTop: 8,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function pctOf(part: number, whole: number): string {
  if (whole <= 0) return "";
  return `${((part / whole) * 100).toFixed(0)}% of sleep`;
}

function stagesForSession(
  stages: SleepStage[],
  session: SleepSession,
): SleepStage[] {
  const from = new Date(session.SleepStart).getTime();
  const to = new Date(session.SleepEnd).getTime();
  return stages.filter((s) => {
    const t = new Date(s.StartTime).getTime();
    return t >= from && t < to;
  });
}

function stageTotals(stages: SleepStage[]): StageTotals {
  const totals: StageTotals = { Deep: 0, Core: 0, REM: 0, Awake: 0 };
  for (const s of stages) {
    if (s.Stage in totals) {
      totals[s.Stage as keyof StageTotals] += s.DurationHr;
    }
  }
  return totals;
}
