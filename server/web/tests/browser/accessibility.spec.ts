import { test, expect, metric } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
for (const path of [
  "/",
  "/nutrition",
  "/sleep",
  "/workouts",
  "/workouts/synthetic-run",
  "/metrics",
  "/correlations",
  "/trends",
  "/settings",
])
  test(`responsive layout ${path}`, async ({ safePage: page }, info) => {
    // Four invented highlights exercise the card grid and long units at narrow widths.
    if (path === "/") {
      const highlights = [
        metric,
        {
          ...metric,
          metric_name: "steps",
          label: "Steps",
          unit: "count",
          latest: 8640,
        },
        {
          ...metric,
          metric_name: "heart_rate_variability",
          label: "HRV",
          unit: "ms",
          latest: 42,
        },
        {
          ...metric,
          metric_name: "vo2_max",
          label: "VO₂ Max",
          unit: "mL/kg/min",
          latest: 48,
        },
      ];
      await page.route("**/api/v1/metrics/latest?*", (route) =>
        route.fulfill({
          json: {
            metrics: highlights,
            heroes: highlights.map((item) => item.metric_name),
            total_available: 4,
            window_days: 30,
          },
        }),
      );
    }
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const width of [320, 390, 767, 768, 1024, 1279, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
          .slice(-12)
          .map((el) => ({
            tag: el.tagName,
            cls: el.className,
            text: el.textContent?.slice(0, 50),
            right: el.getBoundingClientRect().right,
          })),
      );
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
          message: `${path} must fit at ${width}px: ${JSON.stringify(overflow)}`,
        })
        .toBeLessThanOrEqual(width);
    }
    if (process.env.PW_SCREENSHOTS === "1") {
      // All traffic is fixture-backed; snapshots stay in ignored local output.
      await page.waitForLoadState("networkidle");
      for (const width of [1440, 390]) {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 900,
        });
        await expect(page.locator(".app-sidebar")).toHaveCount(
          width < 768 ? 0 : 1,
        );
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect
          .poll(() =>
            page
              .locator(".page-header")
              .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
          )
          .toBe(0);
        await page.screenshot({
          path: info.outputPath(
            `synthetic-${width < 768 ? "mobile" : "desktop"}.png`,
          ),
          animations: "disabled",
          scale: "css",
        });
      }
    }
  });
for (const path of [
  "/nutrition",
  "/settings",
  "/workouts",
  "/trends",
  "/metrics",
  "/correlations",
])
  test(`accessible controls ${path}`, async ({ safePage: page, isMobile }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (path === "/nutrition")
      await expect(
        page.getByRole("region", { name: "Logging status" }),
      ).toBeVisible();
    if (path === "/settings" && isMobile)
      await expect(
        page.getByRole("tabpanel", { name: "Identity", exact: true }),
      ).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      result.violations
        .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
        .map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            html: n.html,
            summary: n.failureSummary,
          })),
        })),
    ).toEqual([]);
  });
