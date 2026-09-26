import AxeBuilder from "@axe-core/playwright";
import { test, expect, night, routes } from "./fixtures";
import type { Page } from "@playwright/test";

const respiratory = [
  { time: night.SleepStart, avg: 14, min: 11.5, max: 18.5, count: 4 },
  { time: "2025-01-14T15:05:00Z", avg: 16, min: 14, max: 20, count: 2 },
  { time: "2025-01-14T16:00:00Z", avg: 17.5, min: 17.5, max: 17.5, count: 1 },
];
async function mockBreathing(page: Page, data = respiratory) {
  await page.route("**/api/v1/timeseries?*", (route) => {
    if (
      new URL(route.request().url()).searchParams.get("metric") !==
      "respiratory_rate"
    )
      return route.fallback();
    return route.fulfill({ json: data });
  });
}

// Switching the overlay must query the chosen vital over the exact night without changing recovery.
test("switches HR, breathing and off; inspects true ranges and sparse interval counts", async ({
  safePage: page,
  isMobile,
}) => {
  await mockBreathing(page);
  await page.goto("/sleep");
  await expect(
    page.getByRole("img", { name: /Heart rate in 15-minute/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Lowest 5-minute average: 60 bpm", { exact: false }),
  ).toBeVisible();
  const request = page.waitForRequest(
    (r) => new URL(r.url()).searchParams.get("metric") === "respiratory_rate",
  );
  await page.getByRole("radio", { name: "Breathing", exact: true }).click();
  const params = new URL((await request).url()).searchParams;
  expect(Object.fromEntries(params)).toEqual({
    metric: "respiratory_rate",
    start: new Date(night.SleepStart).toISOString(),
    end: new Date(night.SleepEnd).toISOString(),
    agg: "5min",
    timezone: "Asia/Singapore",
  });
  const chart = page.getByRole("img", {
    name: /Respiratory rate in 15-minute/,
  });
  await expect(chart).toHaveAccessibleName(
    /Minimum 11.5, maximum 20 breaths\/min/,
  );
  await expect(chart.locator("[data-vital-bucket]")).toHaveCount(2);
  await expect(
    page.getByText("Lowest 5-minute average", { exact: false }),
  ).toHaveCount(0);
  const interactive = page.getByRole("group", {
    name: /Respiratory rate intervals/,
  });
  const bounds = await interactive.boundingBox();
  expect(bounds).not.toBeNull();
  // The first pointer focus in a missing interval must not select the first record.
  if (isMobile)
    await page.touchscreen.tap(
      bounds!.x + bounds!.width / 16,
      bounds!.y + bounds!.height / 2,
    );
  else
    await page.mouse.click(
      bounds!.x + bounds!.width / 16,
      bounds!.y + bounds!.height / 2,
    );
  await expect(
    page.getByText("15-minute recorded ranges", { exact: true }),
  ).toBeVisible();
  if (isMobile)
    await page.touchscreen.tap(
      bounds!.x + bounds!.width / 64,
      bounds!.y + bounds!.height / 2,
    );
  else
    await page.mouse.move(
      bounds!.x + bounds!.width / 64,
      bounds!.y + bounds!.height / 2,
    );
  await expect(
    page.getByText("11.5–20 breaths/min · Avg 15 breaths/min"),
  ).toBeVisible();
  await expect(
    page.getByText("6 imported records · 2 recorded 5-minute intervals"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next recorded interval" }).click();
  await expect(
    page.getByText("17.5–17.5 breaths/min · Avg 17.5 breaths/min"),
  ).toBeVisible();
  await expect(
    page.getByText("1 imported record · 1 recorded 5-minute interval", {
      exact: true,
    }),
  ).toBeVisible();
  await interactive.focus();
  await page.keyboard.press("Home");
  await expect(
    page.getByText("11.5–20 breaths/min · Avg 15 breaths/min"),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByText("17.5–17.5 breaths/min · Avg 17.5 breaths/min"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("15-minute recorded ranges", { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Off", exact: true }).click();
  await expect(chart).toHaveCount(0);
  await expect(page.getByRole("group", { name: /rate intervals/ })).toHaveCount(
    0,
  );
  await page.getByRole("radio", { name: "Heart rate", exact: true }).click();
  await expect(
    page.getByText("Lowest 5-minute average: 60 bpm", { exact: false }),
  ).toBeVisible();
});

// A slow/failed or empty respiratory export must never appear as zero or stale HR data.
test("separates loading, error, retry and absent breathing readings", async ({
  safePage: page,
}) => {
  let response: "wait" | "fail" | "empty" | "success" = "wait";
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/timeseries?*", async (route) => {
    if (
      new URL(route.request().url()).searchParams.get("metric") !==
      "respiratory_rate"
    )
      return route.fallback();
    if (response === "wait") await held;
    await route.fulfill(
      response === "fail"
        ? { status: 503, json: { error: "Synthetic outage" } }
        : { json: response === "empty" ? [] : respiratory },
    );
  });
  await page.goto("/sleep");
  await page.getByRole("radio", { name: "Breathing", exact: true }).click();
  await expect(
    page.getByText("Loading overnight respiratory rate…"),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Heart rate in 15-minute/ }),
  ).toHaveCount(0);
  response = "fail";
  release();
  await expect(
    page.getByText("Respiratory rate could not load.", { exact: false }),
  ).toBeVisible({ timeout: 15000 });
  response = "empty";
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByText("No respiratory-rate readings for this night yet.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Respiratory rate in 15-minute/ }),
  ).toHaveCount(0);
  response = "success";
  await page.reload();
  await page.getByRole("radio", { name: "Breathing", exact: true }).click();
  await expect(
    page.getByRole("img", { name: /Respiratory rate in 15-minute/ }),
  ).toBeVisible();
});

// Changing the date or layout must retain the overlay choice without retaining the old night/readout.
test("night selection and responsive layout retain the selected metric and refresh its window", async ({
  safePage: page,
}) => {
  const previous = {
    ...night,
    Date: "2025-01-13T00:00:00Z",
    SleepStart: "2025-01-13T15:00:00Z",
    SleepEnd: "2025-01-13T23:00:00Z",
  };
  await page.route("**/api/v1/sleep?*", (route) =>
    route.fulfill({
      json: {
        sessions: [night, previous],
        stages: [
          routes["/sleep"].stages[0],
          {
            ...routes["/sleep"].stages[0],
            StartTime: previous.SleepStart,
            EndTime: previous.SleepEnd,
          },
        ],
      },
    }),
  );
  await page.route("**/api/v1/timeseries?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("metric") !== "respiratory_rate") return route.fallback();
    return route.fulfill({
      json: [
        { time: params.get("start"), avg: 13.5, min: 12, max: 15, count: 2 },
      ],
    });
  });
  await page.goto("/sleep");
  await page.getByRole("radio", { name: "Breathing", exact: true }).click();
  await expect(
    page.getByRole("img", { name: /Respiratory rate in 15-minute/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next recorded interval" }).click();
  const request = page.waitForRequest((r) => {
    const params = new URL(r.url()).searchParams;
    return (
      params.get("metric") === "respiratory_rate" &&
      params.get("start") === new Date(previous.SleepStart).toISOString()
    );
  });
  await page.getByRole("button", { name: "Previous day" }).click();
  expect(new URL((await request).url()).searchParams.get("end")).toBe(
    new Date(previous.SleepEnd).toISOString(),
  );
  await expect(
    page.getByRole("radio", { name: "Breathing", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByText("15-minute recorded ranges", { exact: true }),
  ).toBeVisible();
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      page.getByRole("radio", { name: "Breathing", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("img", { name: /Respiratory rate in 15-minute/ }),
    ).toBeVisible();
  }
});

// Theme changes, compact widths and sidebar resizing must not clip bars or the coss controls.
for (const theme of ["light", "dark"] as const) {
  test(`vital chart fits and stays accessible in ${theme} theme`, async ({
    safePage: page,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await mockBreathing(
      page,
      Array.from({ length: 96 }, (_, i) => ({
        time: new Date(
          Date.parse(night.SleepStart) + i * 300_000,
        ).toISOString(),
        avg: 14 + Math.sin(i / 6),
        min: 12 + Math.sin(i / 6),
        max: 17 + Math.cos(i / 5),
        count: 2,
      })),
    );
    // Invented stage transitions are important for reviewing visual layering.
    await page.route("**/api/v1/sleep?*", (route) =>
      route.fulfill({
        json: {
          sessions: [night],
          stages: Array.from({ length: 32 }, (_, i) => ({
            StartTime: new Date(
              Date.parse(night.SleepStart) + i * 900_000,
            ).toISOString(),
            EndTime: new Date(
              Date.parse(night.SleepStart) + (i + 1) * 900_000,
            ).toISOString(),
            Stage: [
              "Core",
              "Deep",
              "Core",
              "REM",
              "Core",
              "Awake",
              "REM",
              "Core",
            ][i % 8],
            DurationHr: 0.25,
            Source: "Synthetic Watch",
          })),
        },
      }),
    );
    await page.goto("/sleep");
    await page.getByRole("radio", { name: "Breathing", exact: true }).click();
    const chart = page.getByRole("img", {
      name: /Respiratory rate in 15-minute/,
    });
    await expect(chart.locator("[data-vital-bucket]")).toHaveCount(32);
    for (const width of [320, 390, 767, 768, 1024, 1279, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(chart).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      // Crossing 768px replaces the responsive tree; wait for its visible chart.
      await expect
        .poll(async () => (await chart.boundingBox())?.width ?? 0)
        .toBeGreaterThan(100);
      if (
        process.env.PW_SCREENSHOTS === "1" &&
        (width === 390 || width === 1440)
      ) {
        await page
          .getByRole("region", { name: "Hypnogram", exact: true })
          .screenshot({
            path: info.outputPath(`synthetic-sleep-${theme}-${width}.png`),
            animations: "disabled",
          });
      }
    }
    const collapse = page.getByRole("button", { name: "Collapse sidebar" });
    await collapse.click();
    await expect(chart).toBeVisible();
    await expect(chart.locator("[data-vital-bucket]")).toHaveCount(32);
    await page.getByRole("button", { name: "About overnight ranges" }).click();
    await expect(
      page.getByText("Daily summaries cannot reconstruct overnight variation", {
        exact: false,
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "About overnight ranges" }),
    ).toBeFocused();
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.failureSummary),
      })),
    ).toEqual([]);
  });
}
