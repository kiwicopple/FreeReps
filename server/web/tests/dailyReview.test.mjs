import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyPoints, dayRange, mean, reviewDay, sleepPoints, weeklyChange } from '../src/utils/dailyReview.ts';

// Prevent UTC midnight or the browser timezone from assigning steps to the wrong local day.
test('Singapore day boundaries preserve hourly sums and missing days', () => {
  const result = dailyPoints([
    { time: '2026-09-19T15:00:00Z', avg: 100 },
    { time: '2026-09-19T16:00:00Z', avg: 200 },
    { time: '2026-09-20T00:00:00Z', avg: 300 },
  ], ['2026-09-19', '2026-09-20', '2026-09-21'], true);
  assert.deepEqual(result.map(p => p.value), [100, 500, null]);
  assert.equal(reviewDay('2026-09-19T16:00:00Z'), '2026-09-20');
  assert.equal(mean(result), 300);
});

// Prevent today's partial activity from entering comparisons or missing days becoming zero.
test('comparison windows exclude today and reject sparse weeks', () => {
  const days = dayRange('2026-09-21', 14);
  assert.equal(days[0], '2026-09-07');
  assert.equal(days[13], '2026-09-20');
  const points = days.map((day, i) => ({ day, value: i < 7 ? 100 : 80 }));
  assert.ok(Math.abs(weeklyChange(points) + 20) < 1e-10);
  points[0].value = null;
  points[1].value = null;
  assert.equal(weeklyChange(points), null);
});

// A UTC-labelled sleep session must appear on its local wake date, and unfinished sleep must be excluded.
test('sleep uses completed local wake dates, including this morning', () => {
  const sessions = [
    { Date: '2026-09-20T00:00:00Z', SleepEnd: '2026-09-20T23:27:00Z', TotalSleep: 6.04 },
    { Date: '2026-09-21T00:00:00Z', SleepEnd: '2026-09-21T23:00:00Z', TotalSleep: 8 },
  ];
  const points = sleepPoints(sessions, ['2026-09-20', '2026-09-21', '2026-09-22'], new Date('2026-09-21T04:00:00Z'));
  assert.deepEqual(points.map(p => p.value), [null, 6.04, null]);
});

// Recorded zero is a measurement; it must not be discarded like a missing observation.
test('zero and invalid values remain distinct', () => {
  const points = dailyPoints([{ time: '2026-09-20T00:00:00Z', avg: 0 }, { time: '2026-09-21T00:00:00Z', avg: NaN }], ['2026-09-20', '2026-09-21'], false);
  assert.deepEqual(points.map(p => p.value), [0, null]);
  assert.equal(mean(points), 0);
});
