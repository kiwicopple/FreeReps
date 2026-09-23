import { readFile } from "node:fs/promises";
import { test, expect, workout } from "./fixtures";
test("metric search preserves selection and CSV values with display multipliers", async ({
  safePage: page,
  isMobile,
}) => {
  test.skip(isMobile, "Metrics intentionally desktop-only");
  await page.route("**/api/v1/metrics/available", (r) =>
    r.fulfill({
      json: [
        {
          metric_name: "height",
          display_label: "Height",
          display_unit: "cm",
          category: "body",
          is_cumulative: false,
          display_multiplier: 100,
          visible: true,
        },
      ],
    }),
  );
  await page.route("**/api/v1/timeseries?*", (r) =>
    r.fulfill({
      json: [
        { time: "2025-01-14", avg: 1.75 },
        { time: "2025-01-15", avg: null },
      ],
    }),
  );
  await page.goto("/metrics?metric=height");
  await expect(
    page.getByRole("combobox", { name: "Metric", exact: true }),
  ).toHaveValue("Height");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /CSV/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("height.csv");
  expect(await readFile((await download.path())!, "utf8")).toBe(
    "date,value\n2025-01-14,175\n2025-01-15,",
  );
});
test("metric combobox and correlation controls retain query keys", async ({
  safePage: page,
  isMobile,
}) => {
  test.skip(isMobile, "Analysis pages intentionally desktop-only");
  await page.goto("/metrics?metric=heart_rate");
  const select = page.getByRole("combobox", { name: "Metric", exact: true });
  await select.fill("HRV");
  await page.getByRole("option", { name: "HRV", exact: true }).click();
  await expect(page).toHaveURL(/metric=heart_rate_variability/);
  await page.goto("/correlations?x=heart_rate&y=heart_rate_variability");
  await page.getByRole("combobox", { name: "Lag", exact: true }).click();
  await page.getByRole("option", { name: "2 days", exact: true }).click();
  await expect(page).toHaveURL(/lag=2/);
  await expect(
    page.getByText(/Not enough|Insufficient|No pairing|paired days/i).first(),
  ).toBeVisible();
});
test("workout pagination resets on type changes and opens detail and back", async ({
  safePage: page,
}) => {
  await page.route("**/api/v1/workouts?*", (r) =>
    r.fulfill({
      json: Array.from({ length: 61 }, (_, i) => ({
        ...workout,
        ID: i === 0 ? "synthetic-run" : `synthetic-${i}`,
        Name: i % 2 ? "Cycling" : "Running",
      })),
    }),
  );
  await page.goto("/workouts");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=1/);
  await page.getByRole("combobox", { name: "Workout type" }).fill("Indoor Run");
  await page.getByRole("option", { name: /Indoor Run/ }).click();
  await expect(page).not.toHaveURL(/page=1/);
  await expect(
    page.getByText("Showing 1–10 of 31", { exact: true }),
  ).toBeVisible();
  // The cards and desktop rows use the same route callback.
  await page.getByText("Indoor Run", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/workouts\/synthetic/);
  await page
    .locator("main")
    .getByRole("link", { name: "Workouts", exact: true })
    .click();
  await expect(page).toHaveURL(/type=Indoor\+Run/);
  await expect(
    page.getByRole("heading", { name: "Workouts", exact: true }),
  ).toBeVisible();
});
test("uPlot resizes with viewport and the retained route map renders", async ({
  safePage: page,
}) => {
  await page.route("**/api/v1/workouts/synthetic-run", (r) =>
    r.fulfill({
      json: {
        ...workout,
        IsIndoor: false,
        HeartRateData: Array.from({ length: 12 }, (_, i) => ({
          Time: new Date(Date.UTC(2025, 0, 14, 0, i)).toISOString(),
          AvgBPM: 100 + i,
          MinBPM: 95,
          MaxBPM: 120,
        })),
        RouteData: [
          { Time: workout.StartTime, Latitude: 1, Longitude: 104 },
          { Time: workout.EndTime, Latitude: 1.01, Longitude: 104.01 },
        ],
      },
    }),
  );
  await page.goto("/workouts/synthetic-run");
  await expect(page.locator(".uplot")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  const canvas = await page.locator(".uplot canvas").elementHandle();
  for (const width of [768, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const selector of [".uplot", ".leaflet-container"]) {
      await expect
        .poll(async () => {
          const b = await page.locator(selector).boundingBox();
          return !!b && b.width > 0 && b.width <= width;
        })
        .toBe(true);
    }
  }
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect
    .poll(() =>
      page
        .locator(".app-sidebar")
        .evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBe(64);
  expect(
    await page
      .locator(".uplot canvas")
      .evaluate((el, original) => el === original, canvas),
  ).toBe(true);
  // Leaflet's SVG renderer re-measures the container, not merely its CSS box.
  const routeSvg = page.locator(".leaflet-overlay-pane svg");
  await expect
    .poll(async () => {
      const box = await page.locator(".leaflet-container").boundingBox();
      return (
        Number(await routeSvg.getAttribute("width")) >= (box?.width ?? Infinity)
      );
    })
    .toBe(true);
});
// Imported strength sessions have no workout row; navigation must carry their metadata.
test("synthetic strength sessions retain exercises and effort units", async ({
  safePage: page,
}) => {
  const strength = {
    ...workout,
    Source: "Hevy",
    Name: "Traditional Strength Training",
    alpha_session_name: "Synthetic strength",
  };
  await page.route("**/api/v1/workouts?*", (r) =>
    r.fulfill({ json: [strength] }),
  );
  await page.route("**/api/v1/workouts/synthetic-run/sets?*", (r) =>
    r.fulfill({
      json: [
        {
          SessionName: "Synthetic strength",
          SessionDate: "2025-01-14",
          ExerciseNumber: 1,
          ExerciseName: "Synthetic squat",
          PrimaryMuscleGroup: "legs",
          Equipment: "barbell",
          SetNumber: 1,
          WeightKg: 50,
          Reps: 5,
          IsWarmup: false,
          RPE: 8,
          RIR: null,
          EffortRIR: 2,
        },
      ],
    }),
  );
  await page.goto("/workouts");
  await page.getByText("Synthetic strength", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic strength" }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic squat", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("RPE 8.0", { exact: true })).toBeVisible();
});
