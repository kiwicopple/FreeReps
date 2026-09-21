import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { fetchImportLogs, fetchSleep, fetchTimeSeries } from "../api";
import {
  coverage, dailyPoints, dayRange, mean, REVIEW_ZONE, reviewDay, shiftDay,
  shortDate, sleepDuration, sleepPoints, weeklyChange, type DailyPoint,
} from "../utils/dailyReview";
import "./dailyReview.css";

const number = (value: number | null, digits = 0) => value == null ? "—" :
  value.toLocaleString("en-GB", { maximumFractionDigits: digits });
const clock = (time: string) => new Date(time).toLocaleTimeString("en-GB", {
  timeZone: REVIEW_ZONE, hour: "2-digit", minute: "2-digit",
});

function useDailyMetric(metric: string, today: string) {
  return useQuery({
    queryKey: ["daily-review", metric, today],
    queryFn: () => fetchTimeSeries(metric, `${shiftDay(today, -56)}T00:00:00+08:00`, new Date().toISOString(), "hourly"),
    staleTime: 60_000, refetchInterval: 300_000,
  });
}

export default function DailyReviewPage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const today = reviewDay(now);
  const days = dayRange(today, 56);
  const stepsQuery = useDailyMetric("step_count", today);
  const rhrQuery = useDailyMetric("resting_heart_rate", today);
  const hrvQuery = useDailyMetric("heart_rate_variability", today);
  const weightQuery = useDailyMetric("weight_body_mass", today);
  const sleepQuery = useQuery({
    queryKey: ["daily-review", "sleep", today],
    // Session Date may be the UTC date rather than the local wake date.
    queryFn: () => fetchSleep(`${shiftDay(today, -57)}T00:00:00Z`, new Date().toISOString()),
    staleTime: 60_000, refetchInterval: 300_000,
  });
  const importsQuery = useQuery({
    queryKey: ["daily-review", "imports"], queryFn: () => fetchImportLogs(1),
    staleTime: 60_000, refetchInterval: 300_000,
  });
  const queries = [stepsQuery, rhrQuery, hrvQuery, weightQuery, sleepQuery, importsQuery];
  const refreshing = queries.some(q => q.isFetching);
  const steps = dailyPoints(stepsQuery.data ?? [], days, true);
  const last28 = steps.slice(-28);
  const week = steps.slice(-7);
  const todaySteps = dailyPoints(stepsQuery.data ?? [], [today], true)[0].value;
  const yesterdaySteps = steps[steps.length - 1]?.value ?? null;
  const change = weeklyChange(steps);
  const sleepDays = dayRange(shiftDay(today, 1), 28);
  const sessions = (sleepQuery.data?.sessions ?? []).filter(s =>
    Date.parse(s.SleepEnd) <= now.getTime() && reviewDay(s.SleepEnd) >= days[0],
  ).sort((a, b) => Date.parse(b.SleepEnd) - Date.parse(a.SleepEnd));
  const latestSleep = sessions[0];
  const sleep = sleepPoints(sessions, sleepDays, now);
  const lastNight = latestSleep && reviewDay(latestSleep.SleepEnd) === today;
  const weights = dailyPoints(weightQuery.data ?? [], days, false).slice(-28);
  const latestWeight = (weightQuery.data ?? []).filter(p => p.avg != null).slice(-1)[0];
  const importLog = importsQuery.data?.[0];
  const stepInsight = coverage(week) >= 6
    ? `You averaged ${number(mean(week))} steps a day over the last seven complete days.${change == null ? "" : ` That’s ${Math.abs(change).toFixed(0)}% ${change >= 0 ? "above" : "below"} the previous seven.`}`
    : "There aren’t enough recorded days yet for a reliable weekly movement comparison.";

  return (
    <div className="daily-review">
      <header className="review-header">
        <div><p className="kick">Your daily check-in · {now.toLocaleDateString("en-GB", { timeZone: REVIEW_ZONE, weekday: "long", day: "numeric", month: "long" })}</p>
          <h1>Your daily health review.</h1>
          <p className="review-muted">Movement, sleep and recovery. Your own data, over time.</p>
        </div>
        <div className="review-actions">
          <button className="btn btn-secondary" disabled={refreshing} onClick={() => {
            setNow(new Date()); void Promise.allSettled(queries.map(q => q.refetch()));
          }}>{refreshing ? "Refreshing…" : "Refresh data ↻"}</button>
          <span className="review-muted">{importsQuery.isError ? "Import status unavailable" : importLog
            ? `Last import ${shortDate(reviewDay(importLog.created_at))}, ${clock(importLog.created_at)}${importLog.status === "success" ? "" : " · check import log"}`
            : importsQuery.isPending ? "Checking imports…" : "No imports yet"}</span>
          <span className="review-muted">Singapore time · refreshes every 5 minutes</span>
        </div>
      </header>

      <section className="review-summary" aria-label="Latest readings">
        <Summary label="Steps today" value={number(todaySteps)} note="Recorded so far · today is incomplete" error={stepsQuery.isError} loading={stepsQuery.isPending}>
          Yesterday: <strong>{number(yesterdaySteps)}</strong> steps
        </Summary>
        <Summary label={lastNight ? "Last night’s sleep" : "Latest recorded sleep"} value={sleepDuration(latestSleep?.TotalSleep ?? null)}
          note={latestSleep ? `Night ending ${shortDate(reviewDay(latestSleep.SleepEnd))} · ${clock(latestSleep.SleepStart)}–${clock(latestSleep.SleepEnd)}` : "No sleep recorded in the last 56 days"}
          error={sleepQuery.isError} loading={sleepQuery.isPending}>
          {latestSleep ? <>Estimated awake: <strong>{latestSleep.InBed >= latestSleep.TotalSleep ? sleepDuration(latestSleep.InBed - latestSleep.TotalSleep) : "unavailable"}</strong></> : "New sleep records will appear here"}
        </Summary>
        <Summary label="Latest weight · hourly average" value={latestWeight ? `${number(latestWeight.avg, 1)} kg` : "—"}
          note={latestWeight ? `Recorded ${shortDate(reviewDay(latestWeight.time))} · ${clock(latestWeight.time)}` : "No weight recorded in the last 56 days"}
          error={weightQuery.isError} loading={weightQuery.isPending}>
          {coverage(weights)} of the last 28 complete days recorded
        </Summary>
      </section>

      <aside className="review-takeaway"><span className="kick">At a glance</span>
        <p>{stepsQuery.isError ? "Movement data couldn’t be loaded. Refresh to try again." : stepsQuery.isPending ? "Reading your recent movement data…" : stepInsight}
          {!sleepQuery.isError && !sleepQuery.isPending && coverage(sleep) < 7 ? ` Sleep is still building a baseline: ${coverage(sleep)} of the last 28 wake dates are represented.` : ""}</p>
      </aside>

      <div className="review-grid">
        <Panel title="Movement" eyebrow="28 complete days" href="/metrics?metric=step_count" loading={stepsQuery.isPending} error={stepsQuery.isError}>
          <div className="review-stat"><strong>{number(mean(last28))}</strong><span>steps / recorded day</span></div>
          <DailyChart points={last28} label="Daily steps" format={v => `${number(v)} steps`} />
          <div className="review-panel-foot"><span>{coverage(last28)}/28 days recorded</span><span>Last 7: {number(mean(week))}/day · {coverage(week)}/7 days</span></div>
          <p className="review-muted">{change == null ? "Weekly comparison needs at least 6 recorded days in each week." : `${change >= 0 ? "+" : ""}${change.toFixed(1)}% across the last two complete 7-day windows.`}</p>
        </Panel>
        <Panel title="Sleep" eyebrow="28 wake dates · through today" href="/sleep" loading={sleepQuery.isPending} error={sleepQuery.isError}>
          <div className="review-stat"><strong>{sleepDuration(mean(sleep))}</strong><span>/ recorded wake date</span></div>
          <DailyChart points={sleep} label="Estimated sleep by local wake date" format={sleepDuration} />
          <div className="review-panel-foot"><span>{coverage(sleep)}/28 wake dates recorded</span><span>Device estimates</span></div>
          <p className="review-muted">{coverage(sleep) < 7 ? "A starting point. More recorded nights are needed to assess consistency." : "Includes completed sleep ending today. Gaps mean no record, not zero sleep."}</p>
        </Panel>
        <section className="review-panel">
          <p className="kick">Recovery · 28 complete days</p><h2>Watch the pattern</h2>
          <Recovery name="Resting heart rate" unit="bpm" points={dailyPoints(rhrQuery.data ?? [], days, false).slice(-28)} loading={rhrQuery.isPending} error={rhrQuery.isError} />
          <Recovery name="Heart rate variability" unit="ms" points={dailyPoints(hrvQuery.data ?? [], days, false).slice(-28)} loading={hrvQuery.isPending} error={hrvQuery.isError} />
          <p className="review-muted">Averages cover recorded days only. Sparse readings cannot establish a recovery trend.</p>
        </section>
        <Panel title="Weight over time" eyebrow="28 complete days" href="/metrics?metric=weight_body_mass" loading={weightQuery.isPending} error={weightQuery.isError}>
          <DailyChart points={weights} label="Daily recorded weight" format={v => `${number(v, 1)} kg`} dots />
          <div className="review-panel-foot"><span>{coverage(weights)}/28 days recorded</span><span>Daily averages · kg</span></div>
          <p className="review-muted">{coverage(weights) < 6 ? "Too few recorded days to establish a weight trend." : "Compare several weeks under similar measurement conditions."} Today’s reading appears above.</p>
        </Panel>
      </div>
      <details className="review-method">
        <summary>How to read this dashboard</summary>
        <p>Activity and recovery charts end yesterday, so partial days don’t distort comparisons. Sleep uses the Singapore wake date and includes completed sleep ending today. Empty slots are missing data, never zero.</p>
        <p>Steps sum recorded hourly totals. Recovery and weight average the observed hourly values within each day, then weight recorded days equally. The latest weight is the latest recorded hourly average. These may differ from individual readings or sample-weighted averages in the baseline report.</p>
        <p>A recorded day does not guarantee full-day coverage. This dashboard uses the app’s source selection; imports without device labels cannot be checked for overlapping devices. It refreshes the stored data, rather than requesting a new phone export. This is a personal record, not a medical assessment.</p>
      </details>
      <footer className="review-footer"><Link to="/overview">All metrics →</Link><Link to="/settings?tab=ingest">Import history →</Link><Link to="/trends">Explore trends →</Link></footer>
    </div>
  );
}

function Summary({ label, value, note, error, loading, children }: { label: string; value: string; note: string; error: boolean; loading: boolean; children: ReactNode }) {
  return <article className="review-summary-card"><p className="kick">{label}</p>
    <div className="review-value num">{loading ? "…" : error ? "—" : value}</div>
    <p className="review-muted">{error ? "Couldn’t load this measurement. Try Refresh data." : loading ? "Loading…" : note}</p>
    {!error && !loading && <div className="review-summary-bottom">{children}</div>}
  </article>;
}

function Panel({ title, eyebrow, href, loading, error, children }: { title: string; eyebrow: string; href: string; loading: boolean; error: boolean; children: ReactNode }) {
  return <section className="review-panel"><div className="review-panel-heading"><div><p className="kick">{eyebrow}</p><h2>{title}</h2></div><Link to={href} aria-label={`Explore ${title.toLowerCase()}`}>Explore ↗</Link></div>
    {loading ? <p className="review-muted" role="status">Loading measurements…</p> : error ? <p role="alert">Couldn’t load this chart. Try Refresh data.</p> : children}
  </section>;
}

function Recovery({ name, unit, points, loading, error }: { name: string; unit: string; points: DailyPoint[]; loading: boolean; error: boolean }) {
  const count = coverage(points);
  return <div className="review-recovery"><div><h3>{name}</h3><p className="review-muted">{loading ? "Loading…" : error ? "Couldn’t load readings" : `${count}/28 days · ${count < 21 ? "limited coverage" : "recorded-day average"}`}</p></div>
    <div className="num"><strong>{loading || error ? "—" : number(mean(points), 1)}</strong> <span className="review-muted">{unit}</span></div>
  </div>;
}

/** Each day keeps its slot, including missing days; isolated measurements never imply a continuous trend. */
function DailyChart({ points, label, format, dots = false }: { points: DailyPoint[]; label: string; format: (value: number | null) => string; dots?: boolean }) {
  const values = points.flatMap(p => p.value == null ? [] : [p.value]);
  const max = values.length ? Math.max(...values) : 1;
  const low = dots && values.length ? Math.min(...values) - 0.5 : 0;
  const high = dots ? max + 0.5 : Math.max(max * 1.1, 1);
  const width = 560, height = 150, left = 50, bottom = 120, plot = width - left - 6;
  return <div className="review-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}. ${coverage(points)} of ${points.length} days recorded.`}>
      {[0, 0.5, 1].map(f => <g key={f}><line x1={left} x2={width} y1={bottom - f * 104} y2={bottom - f * 104} stroke="var(--color-divider)" strokeDasharray="3 4" />
        <text x={left - 7} y={bottom - f * 104 + 4} textAnchor="end" fill="var(--color-neutral-600)" fontSize="10">{number(low + (high - low) * f, dots ? 1 : 0)}</text></g>)}
      {points.map((p, i) => {
        const x = left + (i + 0.5) * plot / points.length;
        const y = p.value == null ? bottom : bottom - (p.value - low) / (high - low) * 104;
        const title = `${shortDate(p.day)}: ${p.value == null ? "No record" : format(p.value)}`;
        return <g key={p.day}><title>{title}</title>{p.value == null
          ? <circle cx={x} cy={bottom + 6} r="1.8" fill="var(--color-neutral-400)" />
          : dots ? <circle cx={x} cy={y} r="4.5" fill="var(--color-data-4)" />
          : <rect x={x - plot / points.length * 0.32} y={y} width={plot / points.length * 0.64} height={Math.max(bottom - y, 1)} rx="2" fill="var(--color-data-3)" />}</g>;
      })}
      <text x={left} y={145} fill="var(--color-neutral-600)" fontSize="10">{shortDate(points[0].day)}</text>
      <text x={width} y={145} textAnchor="end" fill="var(--color-neutral-600)" fontSize="10">{shortDate(points[points.length - 1].day)}</text>
    </svg>
    {!values.length && <p className="review-muted">No recorded values in this window.</p>}
    <details><summary>Daily values · gaps mean missing</summary><div className="review-values">{points.map(p => <div key={p.day}><span>{shortDate(p.day)}</span><span className="num">{p.value == null ? "No record" : format(p.value)}</span></div>)}</div></details>
  </div>;
}
