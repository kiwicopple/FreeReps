import { test } from "node:test";
import assert from "node:assert/strict";
import {
  averageKnown,
  localToday,
  protocolForDate,
  shiftDate,
  targetStatus,
  validDate,
} from "../src/utils/nutrition.ts";
// Protect local-day rollover and missing values from UTC shifts and zero-fill errors.
test("dates and known averages", () => {
  assert.equal(
    localToday("Asia/Singapore", new Date("2025-01-01T17:00:00Z")),
    "2025-01-02",
  );
  assert.equal(shiftDate("2024-03-01", -1), "2024-02-29");
  assert.equal(validDate("2025-02-30"), false);
  const days = [null, 0, 30].map((v) => ({
    nutrients: { energy: { known_subtotal: v } },
  }));
  assert.deepEqual(averageKnown(days as never, "energy"), {
    value: 15,
    count: 2,
  });
});
// Historical dates must retain their effective target rather than the latest protocol.
test("effective protocol and same-date revision", () => {
  const records = [
    { version: 1, protocol: { effective_date: "2025-01-01", notes: "old" } },
    { version: 2, protocol: { effective_date: "2025-02-01", notes: "new" } },
    {
      version: 3,
      protocol: { effective_date: "2025-01-01", notes: "corrected" },
    },
  ];
  assert.equal(protocolForDate(records as never, "2024-12-31"), undefined);
  assert.equal(
    protocolForDate(records as never, "2025-01-15")?.notes,
    "corrected",
  );
  assert.equal(protocolForDate(records as never, "2025-02-15")?.notes, "new");
});
// Missing composition and incomplete days must not create deficiency claims or false safe-limit messages.
test("coverage-aware status", () => {
  const target = {
    value: 90,
    kind: "goal",
    unit: "g",
    source: "test",
    label: "test",
  } as const;
  assert.equal(targetStatus(null, target, true, true), "Unknown");
  assert.equal(targetStatus(30, target, true, false), "Below target so far");
  assert.equal(targetStatus(30, target, true, true), "Potential shortfall");
  assert.equal(
    targetStatus(100, target, false, false),
    "Logged amount reaches target",
  );
  assert.equal(
    targetStatus(30, { ...target, kind: "maximum" }, false, false),
    "Within limit so far",
  );
  assert.equal(
    targetStatus(100, { ...target, upper: 95 }, false, false),
    "Above reference limit",
  );
});
