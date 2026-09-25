import { test, expect, protocol } from "./fixtures";
import type { Page } from "@playwright/test";

async function nutritionRows(page: Page) {
  const catalog = {
    energy: "kcal",
    protein: "g",
    fiber: "g",
    water: "ml",
    vitamin_d: "ug",
    vitamin_k: "ug",
    cholesterol: "mg",
  };
  const total = (unit: string, value: number, complete = false) => ({
    unit,
    known_subtotal: value,
    known_items: complete ? 2 : 1,
    total_items: 2,
    complete_for_logged_items: complete,
    estimated_items: 0,
  });
  await page.route("**/api/v1/food/catalog", (r) =>
    r.fulfill({ json: catalog }),
  );
  await page.route("**/api/v1/food?*", (r) =>
    r.fulfill({
      json: {
        entries: [],
        days: [
          {
            date: "2025-01-15",
            entries: 1,
            items: 2,
            nutrients: {
              fiber: total("g", 12),
              water: total("ml", 900),
              vitamin_d: total("ug", 22),
              vitamin_k: total("ug", 0, true),
              cholesterol: total("mg", 80),
            },
          },
        ],
      },
    }),
  );
  const target = (value: number, unit: string, kind = "goal") => ({
    value,
    unit,
    kind,
    label: "Synthetic target",
    source: "Synthetic reference",
  });
  await page.route("**/api/v1/nutrition/protocol", (r) =>
    r.fulfill({
      json: [
        {
          protocol: {
            ...protocol,
            targets: {
              ...protocol.targets,
              fiber: target(30, "g"),
              water: target(2000, "ml", "reference"),
              vitamin_d: target(10, "ug"),
              vitamin_k: target(95, "ug"),
              cholesterol: target(250, "mg", "maximum"),
            },
          },
          version: 1,
          reason: "Synthetic",
          recorded_at: "2025-01-01T00:00:00Z",
        },
      ],
    }),
  );
}

// A single-line button height let meters and status text paint over the next row.
// Check actual containment, including the 640px button-size breakpoint, not just page overflow.
for (const width of [320, 390, 639, 640, 767, 768, 1024, 1440]) {
  test(`nutrient rows contain their meters and status at ${width}px`, async ({
    safePage: page,
  }, info) => {
    await page.emulateMedia({
      colorScheme: width === 390 || width === 1440 ? "dark" : "light",
      reducedMotion: "reduce",
    });
    await page.setViewportSize({ width, height: 1000 });
    await nutritionRows(page);
    await page.goto("/nutrition");
    const section = page.getByRole("region", {
      name: "Vitamins & minerals",
      exact: true,
    });
    await expect(
      section.getByRole("button", { name: /^Vitamin D/ }),
    ).toBeVisible();
    const fiber = page.getByRole("region", {
      name: "Fiber and water",
      exact: true,
    });
    await expect(fiber).toContainText("Partial data");
    const meter = section.getByRole("meter", {
      name: "Vitamin D logged versus target",
    });
    await expect(meter).toHaveAttribute("aria-valuenow", "10");
    await expect(meter).toHaveAttribute("aria-valuetext", /22.*logged; 10/);
    await expect(
      section.getByRole("button", { name: /^Vitamin K/ }),
    ).toContainText("0");
    await expect(
      section.getByRole("button", { name: /^Vitamin A/ }),
    ).toContainText("Unknown");
    await expect(
      fiber.getByRole("meter", { name: "Water logged versus target" }),
    ).toHaveCount(0);
    const escaping = await page
      .locator(".nutrition-nutrient")
      .evaluateAll((rows) =>
        rows.flatMap((row) => {
          const bounds = row.getBoundingClientRect();
          return [
            ...row.querySelectorAll(
              ".nutrition-label, .nutrition-value, .nutrition-muted, .nutrition-status, [role=meter]",
            ),
          ]
            .filter((el) => {
              const child = el.getBoundingClientRect();
              return (
                child.top < bounds.top - 1 ||
                child.bottom > bounds.bottom + 1 ||
                child.left < bounds.left - 1 ||
                child.right > bounds.right + 1
              );
            })
            .map((el) => ({
              row: row.querySelector(".nutrition-label")?.textContent,
              content: el.textContent,
            }));
        }),
      );
    expect(
      escaping,
      "Every label, value, meter and status must fit its own nutrient row",
    ).toEqual([]);
    for (const card of [fiber, section]) {
      const fits = await card.evaluate((el) => {
        const bounds = el.getBoundingClientRect();
        return [...el.querySelectorAll(".nutrition-nutrient")].every(
          (row) => row.getBoundingClientRect().bottom <= bounds.bottom,
        );
      });
      expect(fits, "Nutrient rows must remain inside their section card").toBe(
        true,
      );
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (process.env.PW_SCREENSHOTS === "1" && (width === 390 || width === 1440))
      await section.screenshot({
        path: info.outputPath(`synthetic-nutrient-rows-${width}.png`),
      });
    const trigger = section.getByRole("button", { name: /^Vitamin D/ });
    await trigger.click();
    const sheet = page.getByRole("dialog", { name: "Vitamin D", exact: true });
    await expect(
      sheet.getByRole("region", { name: "About Vitamin D" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
}

// The same multi-line trigger also appears inside the narrower Other nutrients sheet.
test("nested nutrient rows contain target feedback and still restore focus", async ({
  safePage: page,
}) => {
  await nutritionRows(page);
  await page.goto("/nutrition");
  const trigger = page.getByRole("button", {
    name: "Other nutrients",
    exact: true,
  });
  await trigger.click();
  const parent = page.getByRole("dialog", {
    name: "Other nutrients",
    exact: true,
  });
  const row = parent.locator(".nutrition-nutrient");
  await expect(row.getByRole("meter")).toBeVisible();
  expect(
    await row.evaluate((el) => {
      const bounds = el.getBoundingClientRect();
      return [
        ...el.querySelectorAll(
          ".nutrition-muted, .nutrition-status, [role=meter]",
        ),
      ].every((child) => child.getBoundingClientRect().bottom <= bounds.bottom);
    }),
  ).toBe(true);
  const detail = row.getByRole("button", { name: /^Cholesterol/ });
  await detail.click();
  await page
    .getByRole("button", { name: "Close Cholesterol", exact: true })
    .click();
  await expect(detail).toBeFocused();
  await page
    .getByRole("button", { name: "Close Other nutrients", exact: true })
    .click();
  await expect(trigger).toBeFocused();
});
