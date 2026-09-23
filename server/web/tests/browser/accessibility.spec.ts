import { test, expect } from "./fixtures";
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
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const width of [320, 390, 767, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll("main *")]
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
      await page.screenshot({ path: info.outputPath("synthetic-desktop.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: info.outputPath("synthetic-mobile.png") });
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
        page.getByRole("button", { name: "Edit targets" }),
      ).toBeVisible();
    if (path === "/settings" && isMobile)
      await expect(
        page.getByRole("region", { name: "Alerts", exact: true }),
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
