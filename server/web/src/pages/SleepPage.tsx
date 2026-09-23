import { Empty } from "@/components/ui/empty";
import { Alert } from "@/components/ui/alert";
import DateNavigator from "@/components/DateNavigator";
import PageSection from "@/components/PageSection";
import SummaryValue, { SummaryGrid } from "@/components/SummaryValue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import RecoveryScore from "../components/sleep/RecoveryScore";
import { localToday, shiftDate, validDate } from "../utils/nutrition";
import SleepHeartRate from "../components/sleep/SleepHeartRate";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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
  const range: Range = RANGES.includes(rawRange as Range)
    ? (rawRange as Range)
    : "30d";
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
    ? (sessions.find((s) => s.Date.slice(0, 10) === selectedDate) ?? null)
    : (sessions[0] ?? null);
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
        title="Sleep"
        actions={
          <RangeControl
            options={RANGES}
            value={range}
            onChange={setRange}
            name="sleep-range"
          />
        }
      >
        <DateNavigator
          label="Night date"
          value={date}
          max={today}
          onValueChange={navigateDate}
          onPrevious={() => navigateDate(shiftDate(date, -1))}
          onNext={() => navigateDate(shiftDate(date, 1))}
          nextDisabled={date >= today}
          onReset={() => navigateDate(null)}
          resetLabel="Latest"
        />
      </PageHeader>
      {message ? (
        <Alert
          variant="error"
          className="page-x"
          style={{ color: "var(--muted-foreground)", fontSize: 13 }}
        >
          {message}
          <Button variant="outline" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Alert>
      ) : state === "loading" ? (
        <div
          className="page-x"
          style={{ borderTop: "1px solid var(--border)", paddingTop: 24 }}
        >
          <Skeleton style={{ width: 180, height: 44 }} />
        </div>
      ) : !last ? (
        <Empty
          className="page-x"
          style={{ color: "var(--muted-foreground)", fontSize: 13 }}
        >
          No sleep recorded for this date. Choose another night or return to
          Latest.
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
    <div className="page-x space-y-6">
      <SummaryGrid>
        <SummaryValue
          label="Total sleep"
          value={formatHoursMinutes(session.TotalSleep)}
          detail={
            averageHours != null
              ? `${formatHoursMinutes(averageHours)} on average`
              : ""
          }
        />
        <SummaryValue
          label="Time in bed"
          value={formatHoursMinutes(session.InBed)}
          detail={`${formatClock(session.InBedStart)} → ${formatClock(session.InBedEnd)}`}
        />
        <SummaryValue
          label="Efficiency"
          value={efficiency != null ? `${efficiency.toFixed(0)}%` : "—"}
          detail={`${formatHoursMinutes(totals.Awake)} awake`}
        />
        <SummaryValue
          label="Deep"
          value={formatHoursMinutes(totals.Deep)}
          detail={pctOf(totals.Deep, session.TotalSleep)}
        />
        <SummaryValue
          label="REM"
          value={formatHoursMinutes(totals.REM)}
          detail={pctOf(totals.REM, session.TotalSleep)}
        />
      </SummaryGrid>
      <RecoveryScore session={session} />

      <PageSection title="Stage composition">
        <StageComposition totals={totals} />
      </PageSection>

      <PageSection
        title="Hypnogram"
        description={`${formatClock(session.SleepStart)} → ${formatClock(session.SleepEnd)} · ${awakenings} awakening${awakenings === 1 ? "" : "s"}`}
      >
        <SleepHeartRate stages={stages} />
      </PageSection>

      <PageSection
        title={`Last ${sessions.length} nights`}
        description={
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
      </PageSection>
    </div>
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
    <div className="page-x space-y-6">
      <SummaryGrid>
        <SummaryValue
          label="Total sleep"
          value={formatHoursMinutes(session.TotalSleep)}
          detail={
            <>
              in bed {formatHoursMinutes(session.InBed)}
              {efficiency != null ? ` · ${efficiency.toFixed(0)}% eff.` : ""}
            </>
          }
        />
        <SummaryValue label="Deep" value={formatHoursMinutes(totals.Deep)} />
        <SummaryValue
          label="Efficiency"
          value={efficiency != null ? `${efficiency.toFixed(0)}%` : "—"}
        />
        <SummaryValue
          label="Latency"
          value={latency > 0 ? `${Math.round(latency)}m` : "—"}
        />
      </SummaryGrid>
      <RecoveryScore session={session} />
      <PageSection
        title="Hypnogram"
        description={`${formatClock(session.SleepStart)} → ${formatClock(session.SleepEnd)}`}
      >
        <SleepHeartRate stages={stages} compact />
      </PageSection>
      <PageSection title="Stage composition">
        <StageComposition totals={totals} compact />
      </PageSection>
      <PageSection title={`Last ${Math.min(sessions.length, 10)} nights`} flush>
        {sessions.slice(0, 10).map((s) => (
          <NightRow key={s.Date} session={s} />
        ))}
      </PageSection>
    </div>
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
      <span
        style={{ font: "500 13px var(--font-body)", width: 44, flex: "none" }}
      >
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
