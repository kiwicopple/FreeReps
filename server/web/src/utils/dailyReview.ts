import type { SleepSession, TimeSeriesPoint } from "../api";

export const REVIEW_ZONE = "Asia/Singapore";
const DAY = 86_400_000;
export type DailyPoint = { day: string; value: number | null };

/** Explicit Singapore boundaries keep a travelling browser from moving samples between days. */
export function reviewDay(time: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REVIEW_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(time));
}

export function shiftDay(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY).toISOString().slice(0, 10);
}

export function dayRange(end: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftDay(end, i - count));
}

/** Hourly step sums preserve local midnight; recovery values average the observed hours. */
export function dailyPoints(points: TimeSeriesPoint[], days: string[], sum: boolean): DailyPoint[] {
  const grouped = new Map<string, number[]>();
  for (const point of points) {
    if (point.avg == null || !Number.isFinite(point.avg)) continue;
    const day = reviewDay(point.time);
    grouped.set(day, [...(grouped.get(day) ?? []), point.avg]);
  }
  return days.map(day => {
    const values = grouped.get(day);
    return { day, value: values?.length
      ? values.reduce((a, b) => a + b, 0) / (sum ? 1 : values.length) : null };
  });
}

export function sleepPoints(sessions: SleepSession[], days: string[], now: Date): DailyPoint[] {
  const grouped = new Map<string, number>();
  for (const session of sessions) {
    if (!Number.isFinite(session.TotalSleep) || session.TotalSleep < 0 ||
        Date.parse(session.SleepEnd) > now.getTime()) continue;
    const day = reviewDay(session.SleepEnd);
    grouped.set(day, (grouped.get(day) ?? 0) + session.TotalSleep);
  }
  return days.map(day => ({ day, value: grouped.get(day) ?? null }));
}

export function mean(points: DailyPoint[]): number | null {
  const values = points.flatMap(p => p.value == null ? [] : [p.value]);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function coverage(points: DailyPoint[]): number {
  return points.filter(p => p.value != null).length;
}

/** Suppress comparisons when either week has fewer than six recorded days. */
export function weeklyChange(points: DailyPoint[]): number | null {
  const recent = points.slice(-7), previous = points.slice(-14, -7);
  if (coverage(recent) < 6 || coverage(previous) < 6) return null;
  const before = mean(previous), after = mean(recent);
  return before == null || after == null || before === 0 ? null : (after / before - 1) * 100;
}

export function sleepDuration(hours: number | null): string {
  if (hours == null) return "—";
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function shortDate(day: string): string {
  return new Date(`${day}T12:00:00+08:00`).toLocaleDateString("en-GB", {
    timeZone: REVIEW_ZONE, day: "numeric", month: "short",
  });
}
