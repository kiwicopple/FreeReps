import { strict as assert } from "node:assert";
import { recoveryScore, type RecoveryNight } from "../src/utils/recovery.ts";

// Guard against inflated scores from missing vitals and future-data leakage.
const night = (day: number, value = 60): RecoveryNight => {
  const date = `2026-09-${String(day).padStart(2, "0")}`;
  const start = `${date}T00:00:00Z`, end = `${date}T08:00:00Z`;
  const points = Array.from({ length: 96 }, (_, i) => ({ time: new Date(Date.parse(start) + i * 300000).toISOString(), avg: value, min: value, max: value, count: 1 }));
  return { session: { ID: day, UserID: 1, Date: date, TotalSleep: 8, Asleep: 8, InBed: 8, Core: 5, Deep: 1, REM: 2, SleepStart: start, SleepEnd: end, InBedStart: start, InBedEnd: end }, heart: points, hrv: points };
};
const current = night(20);
const baseline = Array.from({ length: 7 }, (_, i) => night(i + 10));
assert.equal(recoveryScore(current, baseline).score, 100);
assert.equal(recoveryScore(current, baseline).coverage, 100);
assert.equal(recoveryScore(current, baseline.slice(0, 6)).coverage, 60);
assert.equal(recoveryScore(current, baseline.slice(0, 6)).sleepOnly, true);
assert.deepEqual(recoveryScore(current, baseline), recoveryScore(current, [...baseline, night(21, 200), night(20, 200)]));
assert.equal(recoveryScore({ ...current, heart: [], hrv: [] }, baseline).coverage, 60);
assert.ok(recoveryScore(night(20, 80), baseline).score! < 100);
assert.equal(recoveryScore({ ...current, session: { ...current.session, TotalSleep: 0 } }, baseline).score, null);
assert.equal(recoveryScore({ ...current, session: { ...current.session, TotalSleep: 4, Asleep: 4 } }, []).score, 50);
console.log("Recovery checks passed: calibration, missing data, sparse history, future exclusion, deviations and invalid sleep.");
