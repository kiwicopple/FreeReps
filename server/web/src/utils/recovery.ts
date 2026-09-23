import type { SleepSession, TimeSeriesPoint } from "../api";

export type RecoveryNight = { session: SleepSession; heart: TimeSeriesPoint[]; hrv: TimeSeriesPoint[] };
export const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const clamp = (v: number) => Math.max(0, Math.min(100, v));
const duration = (s: SleepSession) => (Date.parse(s.SleepEnd) - Date.parse(s.SleepStart)) / 3600000;
export function nightVital(night: RecoveryNight, key: "heart" | "hrv"): number | null {
  const start = Date.parse(night.session.SleepStart), end = Date.parse(night.session.SleepEnd);
  const points = night[key].filter((p) => p.avg != null && Number.isFinite(p.avg) && p.avg > 0 && Date.parse(p.time) < end && Date.parse(p.time) + 300000 > start);
  // Sparse HRV is expected; heart rate needs at least half the night's buckets.
  const required = key === "heart" ? Math.max(3, Math.ceil(duration(night.session) * 12 * 0.5)) : 3;
  return points.length >= required ? median(points.map((p) => p.avg!)) : null;
}

/** Experimental v1: only prior nights enter baselines; missing inputs never become zero. */
export function recoveryScore(current: RecoveryNight, history: RecoveryNight[]) {
  const s = current.session;
  const cutoff = Date.parse(s.Date);
  const prior = history.filter((n) => Date.parse(n.session.Date) < cutoff && Date.parse(n.session.Date) >= cutoff - 28 * 86400000);
  const sleepValid = Number.isFinite(s.TotalSleep) && s.TotalSleep > 0 && s.TotalSleep <= 24;
  const continuityValid = sleepValid && s.InBed > 0 && s.InBed <= 24 && s.Asleep > 0 && s.Asleep <= s.InBed;
  const parts: { name: string; weight: number; score: number | null; detail: string }[] = [
    { name: "Sleep duration", weight: 40, score: sleepValid ? clamp(s.TotalSleep / 8 * 100) : null, detail: `${s.TotalSleep.toFixed(1)} hours · 8-hour reference` },
    { name: "Sleep continuity", weight: 20, score: continuityValid ? clamp(s.Asleep / s.InBed * 100) : null, detail: continuityValid ? `${Math.round(s.Asleep / s.InBed * 100)}% asleep during the recorded window` : "No usable sleep-window data" },
  ];
  for (const key of ["heart", "hrv"] as const) {
    const value = nightVital(current, key);
    const baselineValues = prior.map((n) => nightVital(n, key)).filter((v): v is number => v != null);
    const baseline = median(baselineValues);
    const ready = value != null && baseline != null && baselineValues.length >= 7;
    // Typical earns full credit. Departures in either direction do not earn bonuses.
    const difference = ready ? Math.abs(value! / baseline! - 1) : 0;
    parts.push({ name: key === "heart" ? "Overnight heart rate" : "Overnight HRV", weight: 20,
      score: ready ? clamp(100 - difference * (key === "heart" ? 500 : 200)) : null,
      detail: `${value == null ? "Too few readings tonight" : `${value.toFixed(1)} ${key === "heart" ? "bpm" : "ms"}` } · ${baselineValues.length}/7 baseline nights${ready ? ` · usual ${baseline!.toFixed(1)}` : " needed"}`,
    });
  }
  const included = parts.filter((p) => p.score != null);
  const coverage = included.reduce((sum, p) => sum + p.weight, 0);
  // A sleep-based score is not offered without valid duration and continuity.
  const score = sleepValid && continuityValid ? Math.round(included.reduce((sum, p) => sum + p.score! * p.weight, 0) / coverage) : null;
  return { score, parts, coverage, provisional: coverage < 100, sleepOnly: parts.slice(2).every((p) => p.score == null) };
}
