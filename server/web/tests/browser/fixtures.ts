import { test as base, expect, type Page } from "@playwright/test";

// Entirely invented data. Never replace these fixtures with real API captures.
export const night = {
  ID: 1,
  UserID: 1,
  Date: "2025-01-14T00:00:00Z",
  TotalSleep: 7,
  Asleep: 7,
  Core: 4,
  Deep: 1,
  REM: 2,
  InBed: 8,
  SleepStart: "2025-01-14T15:00:00Z",
  SleepEnd: "2025-01-14T23:00:00Z",
  InBedStart: "2025-01-14T15:00:00Z",
  InBedEnd: "2025-01-14T23:00:00Z",
};
export const metric = {
  metric_name: "heart_rate",
  label: "Heart Rate",
  category: "cardiovascular",
  unit: "bpm",
  is_cumulative: false,
  multiplier: 1,
  source: "Synthetic Watch",
  time: "2025-01-15T00:00:00Z",
  latest: 60,
  delta_7d: 2,
  delta_7d_pct: 0.03,
  range_low: 50,
  range_high: 80,
  series: [60, 61, 59, 58, 62, 60, 60],
};
export const workout = {
  ID: "synthetic-run",
  UserID: 1,
  Name: "Running",
  StartTime: "2025-01-14T00:00:00Z",
  EndTime: "2025-01-14T00:30:00Z",
  DurationSec: 1800,
  Location: "",
  IsIndoor: true,
  ActiveEnergyBurned: 200,
  ActiveEnergyUnits: "kcal",
  TotalEnergy: 250,
  TotalEnergyUnits: "kcal",
  Distance: 5000,
  DistanceUnits: "m",
  AvgHeartRate: 120,
  MaxHeartRate: 150,
  MinHeartRate: 80,
  ElevationUp: null,
  ElevationDown: null,
};
export const protocol = {
  effective_date: "2025-01-01",
  timezone: "Asia/Singapore",
  profile: {
    age: 30,
    sex: "male",
    height_cm: 175,
    weight_kg: 75,
    activity: "Moderate",
    goal: "Maintain",
    preferences: "",
  },
  notes: "Synthetic protocol",
  targets: {
    energy: {
      value: 2200,
      unit: "kcal",
      kind: "goal",
      label: "Energy",
      source: "",
    },
    protein: {
      value: 100,
      unit: "g",
      kind: "goal",
      label: "Protein",
      source: "",
    },
  },
};
export const routes: Record<string, unknown> = {
  "/me": { login: "synthetic", display_name: "Test Person" },
  "/version": { version: "test" },
  "/stats": {
    total_metric_rows: 10,
    total_workouts: 1,
    total_sleep_nights: 1,
    total_sets: 0,
    workouts_by_type: [],
  },
  "/metrics/latest": {
    metrics: [metric],
    heroes: ["heart_rate"],
    total_available: 1,
    window_days: 30,
    last_sync: metric.time,
    last_sources: ["Synthetic Watch"],
  },
  "/metrics/available": [
    {
      metric_name: "heart_rate",
      display_label: "Heart Rate",
      display_unit: "bpm",
      category: "cardiovascular",
      is_cumulative: false,
      display_multiplier: 1,
      visible: true,
    },
    {
      metric_name: "heart_rate_variability",
      display_label: "HRV",
      display_unit: "ms",
      category: "cardiovascular",
      is_cumulative: false,
      display_multiplier: 1,
      visible: true,
    },
  ],
  "/metrics/stats": {
    metric: "heart_rate",
    avg: 60,
    min: 55,
    max: 65,
    stddev: 2,
    count: 10,
  },
  "/timeseries": Array.from({ length: 30 }, (_, i) => ({
    time: new Date(Date.UTC(2025, 0, 14, 15, i * 5)).toISOString(),
    avg: 60 + (i % 3),
    min: 58,
    max: 65,
    count: 1,
  })),
  "/sleep": {
    sessions: [night],
    stages: [
      {
        StartTime: night.SleepStart,
        EndTime: night.SleepEnd,
        Stage: "Core",
        DurationHr: 8,
        Source: "Synthetic Watch",
      },
    ],
  },
  "/workouts": [workout],
  "/workouts/zones": {
    max_heart_rate: 180,
    zones: [{ workout_id: workout.ID, shares: [0.2, 0.3, 0.3, 0.1, 0.1] }],
  },
  "/workouts/synthetic-run": { ...workout, HeartRateData: [], RouteData: [] },
  "/workouts/synthetic-run/sets": [],
  "/preferences/birth-date": { birth_date: "" },
  "/preferences/max-heart-rate": {
    bpm: 180,
    origin: "estimated",
    observed: 170,
    estimated: 180,
    age: 30,
  },
  "/source-priority": {
    default: ["Synthetic Watch", ""],
    rules: [],
    sources: ["Synthetic Watch", ""],
    activity: [],
  },
  "/oura/status": {
    configured: false,
    connected: false,
    redirect_uri: "https://example.invalid/oura/callback",
  },
  "/withings/status": {
    configured: false,
    connected: false,
    redirect_uri: "https://example.invalid/withings/callback",
  },
  "/hevy/status": { configured: false },
  "/import-logs": [],
  "/alerts": {
    settings: {
      enabled: false,
      ntfy_url: "",
      hostname: "synthetic",
      check_interval_sec: 60,
      failure_threshold: 3,
      apple_silence_sec: 0,
    },
    conditions: [],
  },
  "/food/catalog": {
    energy: "kcal",
    protein: "g",
    fiber: "g",
    cholesterol: "mg",
  },
  "/food": {
    entries: [
      {
        version: 1,
        entry: {
          id: "synthetic-food",
          local_date: "2025-01-15",
          timezone: "Asia/Singapore",
          time_precision: "day",
          meal: "Breakfast",
          notes: "Synthetic fixture",
          status: "recorded",
          items: [
            {
              name: "Synthetic oats",
              kind: "food",
              portion: "one bowl",
              assumptions: "test",
              nutrients: {
                energy: {
                  value: 300,
                  unit: "kcal",
                  basis: "test",
                  confidence: "estimated",
                  reference: "",
                },
                protein: {
                  value: 10,
                  unit: "g",
                  basis: "test",
                  confidence: "estimated",
                  reference: "",
                },
              },
            },
          ],
        },
      },
    ],
    days: [
      {
        date: "2025-01-15",
        entries: 1,
        items: 1,
        nutrients: {
          energy: {
            unit: "kcal",
            known_subtotal: 300,
            known_items: 1,
            total_items: 1,
            complete_for_logged_items: true,
            estimated_items: 1,
          },
          protein: {
            unit: "g",
            known_subtotal: 10,
            known_items: 1,
            total_items: 1,
            complete_for_logged_items: true,
            estimated_items: 1,
          },
        },
      },
    ],
  },
  "/nutrition/protocol": [
    {
      protocol,
      version: 1,
      reason: "Synthetic",
      recorded_at: "2025-01-01T00:00:00Z",
    },
  ],
  "/nutrition/days": [{ date: "2025-01-15", complete: false, version: 1 }],
};
export const test = base.extend<{ safePage: Page }>({
  safePage: async ({ page }, use) => {
    const unexpected: string[] = [];
    await page.clock.setFixedTime(new Date("2025-01-15T04:00:00Z"));
    await page.route("**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.origin !== "http://127.0.0.1:4173") {
        await route.abort();
        return;
      }
      if (!url.pathname.startsWith("/api/")) {
        await route.continue();
        return;
      }
      const key = url.pathname.replace("/api/v1", "");
      if (req.method() !== "GET" || !(key in routes)) {
        unexpected.push(req.method() + " " + key);
        await route.fulfill({
          status: 501,
          json: { error: "Unmocked request" },
        });
        return;
      }
      await route.fulfill({ json: routes[key] });
    });
    await use(page);
    expect(unexpected, "Tests must never reach the real API").toEqual([]);
  },
});
export { expect };
