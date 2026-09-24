import { test, expect, metric } from "./fixtures";
import type { Page } from "@playwright/test";
import type { FrontPageResponse } from "../../src/api";
import AxeBuilder from "@axe-core/playwright";
const today = Date.UTC(2025, 0, 15),
  DAY = 86400000;
function response(range = "30d"): FrontPageResponse {
  const count =
    (
      { "1d": 1, "7d": 7, "30d": 30, "90d": 90, "1y": 365 } as Record<
        string,
        number
      >
    )[range] ?? 30;
  const start = today - (count - 1) * DAY;
  const series = Array.from({ length: count }, (_, i) =>
    start + i * DAY === today
      ? 75
      : start + i * DAY >= today - 7 * DAY
        ? 50
        : 40,
  );
  return {
    metrics: [
      {
        ...metric,
        metric_name: "heart_rate_variability",
        label: "HRV",
        latest: 55,
        unit: "ms",
        series,
      },
      {
        ...metric,
        metric_name: "walking_asymmetry_percentage",
        label: "Walking Asymmetry",
        unit: "%",
        series: series.map(() => 0),
        latest: 0,
      },
      {
        ...metric,
        metric_name: "weight_body_mass",
        category: "body",
        label: "Weight",
        unit: "kg",
        latest: null,
        series: series.map(() => null),
      },
      {
        ...metric,
        metric_name: "dietary_protein",
        category: "nutrition",
        label: "Protein",
        unit: "g",
        is_cumulative: true,
        series,
      },
      { ...metric, metric_name: "new_metric", label: "New Metric", series },
    ],
    heroes: ["heart_rate_variability"],
    total_available: 5,
    window_days: count,
    window_start: new Date(start).toISOString(),
    last_sync: null,
    last_sources: [],
  };
}
async function setup(page: Page) {
  await page.route("**/api/v1/metrics/latest?*", (r) =>
    r.fulfill({
      json: response(
        new URL(r.request().url()).searchParams.get("range") ?? "30d",
      ),
    }),
  );
  await page.goto("/");
}
const rows = (page: Page) =>
  page.getByRole("region", { name: "All metrics", exact: true });

// Hero cards and all loaded rows are entrypoints, with full education on either layout.
test("Today metric cards and rows open the right sheet with personal context", async ({
  safePage: page,
}) => {
  await setup(page);
  const hero = page
    .getByRole("region", { name: "Key metrics" })
    .getByRole("button", { name: "View HRV details" });
  await hero.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "HRV", exact: true });
  await expect(sheet).toBeVisible();
  await expect(
    sheet.getByRole("img", { name: /HRV daily averages trend/ }),
  ).toBeVisible();
  await expect(sheet.getByText("55 ms", { exact: true })).toBeVisible();
  await expect(sheet.getByText("50 ms", { exact: true })).toBeVisible();
  await expect(sheet.getByText("40 ms", { exact: true })).toBeVisible();
  await expect(
    sheet.getByText(/\+10 ms compared with the previous week/),
  ).toBeVisible();
  await expect(sheet.getByRole("link", { name: /Learn more/ })).toHaveAttribute(
    "href",
    /clevelandclinic/,
  );
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(hero).toBeFocused();
  for (const label of [
    "HRV",
    "Walking Asymmetry",
    "Weight",
    "Protein",
    "New Metric",
  ]) {
    const trigger = rows(page).getByRole("button", {
      name: `View ${label} details`,
    });
    await trigger.click();
    const details = page.getByRole("dialog", { name: label, exact: true });
    await expect(
      details.getByRole("heading", { name: "What it means" }),
    ).toBeVisible();
    await expect(
      details.getByRole("heading", { name: "What good looks like" }),
    ).toBeVisible();
    if (label === "Walking Asymmetry")
      await expect(
        details.getByText("0 %", { exact: true }).first(),
      ).toBeVisible();
    if (label === "Weight") {
      await expect(
        details.getByText("No readings in this period."),
      ).toBeVisible();
      await expect(details.getByText(/Not enough history/)).toBeVisible();
    }
    if (label === "Protein")
      await expect(details.getByText(/Provides amino acids/)).toBeVisible();
    if (label === "New Metric")
      await expect(
        details.getByText(/specific explanation.*not yet available/),
      ).toBeVisible();
    await details
      .getByRole("button", { name: `Close ${label}`, exact: true })
      .click();
    await expect(trigger).toBeFocused();
  }
});

// The sheet's selected window is independent of the page and comparisons exclude today's partial data.
test("metric sheet ranges, daily values and analysis links retain dates and units", async ({
  safePage: page,
  isMobile,
}) => {
  await setup(page);
  await rows(page).getByRole("button", { name: "View HRV details" }).click();
  const sheet = page.getByRole("dialog", { name: "HRV", exact: true });
  await sheet.getByRole("radio", { name: "7d", exact: true }).click();
  await expect(sheet.getByText(/7 of 7 days recorded/)).toBeVisible();
  await expect(
    sheet.getByText(/\+10 ms compared with the previous week/),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await sheet
    .getByRole("button", { name: "Daily values", exact: true })
    .click();
  await expect(sheet.getByRole("row", { name: "2025-01-15 75" })).toBeVisible();
  await expect(sheet.getByRole("row", { name: "2025-01-14 50" })).toBeVisible();
  if (!isMobile) {
    await sheet
      .getByRole("link", { name: "Open full metric analysis" })
      .click();
    await expect(page).toHaveURL(/metric=heart_rate_variability&range=7d/);
    await expect(sheet).toHaveCount(0);
    await page.goBack();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } else
    await expect(
      sheet.getByRole("link", { name: "Open full metric analysis" }),
    ).toHaveCount(0);
});

// A failed window fetch must retain useful education and an explicit retry rather than invent a zero trend.
test("metric history loading, failures and retry remain distinct", async ({
  safePage: page,
}) => {
  await setup(page);
  let fail = true,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/metrics/latest?range=90d", async (r) => {
    await gate;
    await r.fulfill(
      fail
        ? { status: 500, json: { error: "Synthetic failure" } }
        : { json: response("90d") },
    );
  });
  await rows(page).getByRole("button", { name: "View HRV details" }).click();
  const sheet = page.getByRole("dialog", { name: "HRV", exact: true });
  await sheet.getByRole("radio", { name: "90d", exact: true }).click();
  await expect(sheet.getByLabel("Loading metric history")).toBeVisible();
  release();
  await expect(
    sheet.getByRole("button", { name: "Retry history" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    sheet.getByRole("heading", { name: "What it means" }),
  ).toBeVisible();
  fail = false;
  await sheet.getByRole("button", { name: "Retry history" }).click();
  await expect(sheet.getByText(/90 of 90 days recorded/)).toBeVisible();
});

// Sheets must not overflow, hide the close control, lose focus or clip the chart at any supported width.
for (const colorScheme of ["light", "dark"] as const)
  test(`metric sheet is accessible and responsive in ${colorScheme}`, async ({
    safePage: page,
  }, info) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await setup(page);
    for (const width of [320, 390, 767, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const trigger = rows(page).getByRole("button", {
        name: "View HRV details",
      });
      await trigger.click();
      const sheet = page.getByRole("dialog", { name: "HRV", exact: true });
      await expect(sheet.locator("canvas")).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      await expect
        .poll(async () => {
          const box = await sheet.locator(".uplot").boundingBox();
          const panel = await sheet.boundingBox();
          return !!box && !!panel && box.width > 100 && box.width < panel.width;
        })
        .toBe(true);
      const panel = sheet.locator('[data-slot="scroll-area-viewport"]');
      await panel.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(
        sheet.getByRole("button", { name: "Close HRV", exact: true }),
      ).toBeInViewport();
      if (width === 390 || width === 1440) {
        const audit = await new AxeBuilder({ page })
          .exclude("[data-base-ui-focus-guard]")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        expect(
          audit.violations.filter((v) =>
            ["serious", "critical"].includes(v.impact ?? ""),
          ),
        ).toEqual([]);
        if (process.env.PW_SCREENSHOTS === "1") {
          await panel.evaluate((el) => {
            el.scrollTop = 0;
          });
          await page.screenshot({
            path: info.outputPath(
              `synthetic-metric-sheet-${width}-${colorScheme}.png`,
            ),
            animations: "disabled",
          });
        }
      }
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  });
