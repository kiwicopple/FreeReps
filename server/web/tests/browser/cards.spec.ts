import { test, expect, routes } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import type { FoodLog } from "../../src/nutritionApi";

// The fixed app chrome must remain reachable and avoid overlapping the primary nav,
// including when date controls wrap on a narrow phone.
test("secondary header stays visible beneath navigation across breakpoints", async ({
  safePage: page,
}) => {
  await page.goto("/nutrition");
  await expect(
    page.getByRole("region", { name: "Logging status" }),
  ).toBeVisible();
  for (const width of [320, 390, 767, 768, 1024, 1279, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect
      .poll(() =>
        page
          .locator(".page-header")
          .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
      )
      .toBe(0);
    if (width >= 768)
      await expect
        .poll(() =>
          page
            .locator(".app-sidebar")
            .evaluate((el) => Math.round(el.getBoundingClientRect().width)),
        )
        .toBe(width < 1280 ? 64 : 224);
    const date = page.getByRole("button", { name: "Choose end date" });
    await date.click();
    await expect(page.getByLabel("Enter date", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(date).toBeFocused();
  }
});

// Macro cards are modal sheets on desktop as well as mobile. Long synthetic
// contributions must scroll inside the sheet, with focus restored on dismissal.
test("all four nutrition cards open accessible scrolling sheets at every width", async ({
  safePage: page,
}, info) => {
  const food = structuredClone(routes["/food"] as FoodLog);
  food.entries = Array.from({ length: 30 }, (_, index) => ({
    ...food.entries[0],
    entry: { ...food.entries[0].entry, id: `synthetic-contribution-${index}` },
  }));
  await page.route("**/api/v1/food?*", (route) =>
    route.fulfill({ json: food }),
  );
  await page.goto("/nutrition");
  const cards = page.getByRole("region", { name: "Calories and macros" });
  await expect(cards.getByRole("button")).toHaveCount(4);
  for (const name of ["Calories", "Protein", "Carbohydrate", "Fat"]) {
    const trigger = cards.getByRole("button", { name: new RegExp(`^${name}`) });
    await trigger.click();
    const sheet = page.getByRole("dialog", { name, exact: true });
    await expect(sheet).toBeVisible();
    await expect(sheet).not.toHaveAttribute("data-starting-style", "");
    await sheet.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)); });
    await expect(
      sheet.getByRole("region", { name: `About ${name}` }),
    ).toBeVisible();
    if (name === "Calories" && process.env.PW_SCREENSHOTS === "1")
      await page.screenshot({
        path: info.outputPath("synthetic-macro-sheet.png"),
        animations: "disabled",
        scale: "css",
      });
    const panel = sheet.locator('[data-slot="scroll-area-viewport"]');
    await expect
      .poll(() => panel.evaluate((el) => el.scrollHeight > el.clientHeight))
      .toBe(true);
    const pageScroll = await page.evaluate(() => window.scrollY);
    await panel.evaluate((el) => (el.scrollTop = 300));
    await expect
      .poll(() => panel.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
    if (name === "Calories") {
      const audit = await new AxeBuilder({ page })
        .exclude("[data-base-ui-focus-guard]")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(
        audit.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact ?? ""),
        ),
      ).toEqual([]);
    }
    await sheet
      .getByRole("button", { name: `Close ${name}`, exact: true })
      .click();
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});
