import { test, expect, protocol, routes } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

// Reject malformed days before URL/query changes and keep the picker usable by keyboard.
for (const path of ["nutrition", "sleep"] as const) {
  test(`${path} date navigation validates direct entry and restores focus`, async ({
    safePage: page,
  }) => {
    await page.goto(`/${path}`);
    const picker = page.getByRole("button", {
      name: path === "sleep" ? "Choose night date" : "Choose end date",
    });
    const initialURL = page.url();
    await picker.focus();
    await page.keyboard.press("Enter");
    const input = page.getByLabel("Enter date", { exact: true });
    await input.fill("2025-02-30");
    await input.press("Enter");
    await expect(
      page.getByText("Enter a valid date in YYYY-MM-DD format."),
    ).toBeVisible();
    expect(page.url()).toBe(initialURL);
    if (path === "sleep") {
      await input.fill("2025-01-16");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      await expect(
        page.getByText("Choose a date on or before 2025-01-15."),
      ).toBeVisible();
      expect(page.url()).toBe(initialURL);
    }
    await input.fill("2025-01-10");
    await input.press("Enter");
    await expect(page).toHaveURL(/date=2025-01-10/);
    await expect(picker).toContainText("2025-01-10");
    await expect(picker).toBeFocused();
    await page.getByRole("button", { name: "Next day", exact: true }).click();
    await expect(page).toHaveURL(/date=2025-01-11/);
    await page
      .getByRole("button", { name: "Previous day", exact: true })
      .click();
    await expect(page).toHaveURL(/date=2025-01-10/);
    await page
      .getByRole("button", {
        name: path === "sleep" ? "Latest" : "Today",
        exact: true,
      })
      .click();
    if (path === "sleep") await expect(page).not.toHaveURL(/date=/);
    else await expect(picker).toContainText("2025-01-15");
    await picker.click();
    await page.keyboard.press("Escape");
    await expect(picker).toBeFocused();
  });
}

// Midnight in positive and negative UTC offsets must select the user's calendar day.
for (const timezoneId of ["Pacific/Kiritimati", "America/Los_Angeles"]) {
  test.describe(`local calendar in ${timezoneId}`, () => {
    test.use({ timezoneId });
    test("selection is date-only", async ({ safePage: page }) => {
      await page.goto("/nutrition?date=2025-01-15");
      await page.getByRole("button", { name: "Choose end date" }).click();
      await page.getByRole("button", { name: /January 10th, 2025/ }).click();
      await expect(page).toHaveURL(/date=2025-01-10/);
    });
  });
}

// Visual saturation must not hide over-target quantities or turn unknown intake into zero.
test("compact nutrient rows retain unknown, zero, partial data and honest meters", async ({
  safePage: page,
}) => {
  await page.route("**/api/v1/food?*", (route) =>
    route.fulfill({
      json: {
        entries: [],
        days: [
          {
            date: "2025-01-15",
            entries: 1,
            items: 2,
            nutrients: {
              energy: {
                unit: "kcal",
                known_subtotal: 3000,
                known_items: 1,
                total_items: 2,
                complete_for_logged_items: false,
                estimated_items: 1,
              },
              fiber: {
                unit: "g",
                known_subtotal: 0,
                known_items: 2,
                total_items: 2,
                complete_for_logged_items: true,
                estimated_items: 0,
              },
              protein: {
                unit: "g",
                known_subtotal: 10,
                known_items: 2,
                total_items: 2,
                complete_for_logged_items: true,
                estimated_items: 0,
              },
            },
          },
        ],
      },
    }),
  );
  await page.route("**/api/v1/nutrition/protocol", (route) =>
    route.fulfill({
      json: [
        {
          protocol: {
            ...protocol,
            targets: {
              ...protocol.targets,
              protein: { ...protocol.targets.protein, value: 0 },
            },
          },
          version: 1,
          reason: "Synthetic",
          recorded_at: "2025-01-01T00:00:00Z",
        },
      ],
    }),
  );
  await page.goto("/nutrition");
  const meter = page.getByRole("meter", {
    name: "Calories logged versus target",
  });
  await expect(meter).toHaveAttribute(
    "aria-valuetext",
    /3.?000 kcal logged; 2.?200 kcal/,
  );
  await expect(meter).toHaveAttribute("aria-valuenow", "2200");
  await expect(
    page.getByRole("meter", { name: "Protein logged versus target" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Fiber/ })).toContainText("0");
  await expect(page.getByRole("button", { name: /^Water/ })).toContainText(
    "Unknown",
  );
  await expect(page.getByRole("button", { name: /^Calories/ })).toContainText(
    "Partial data",
  );
  await expect(
    page.getByRole("button", { name: "Mark day complete", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Calories/ }).click();
  await expect(
    page.getByText("1/2 items have values · 1 estimated"),
  ).toBeVisible();
});

// Async saves must restore focus after Edit targets is re-enabled, just as cancellation does.
test("protocol editor focuses its heading and restores Edit targets after cancel and save", async ({
  safePage: page,
}) => {
  const records = structuredClone(routes["/nutrition/protocol"]) as {
    protocol: typeof protocol;
  }[];
  for (const target of Object.values(records[0].protocol.targets))
    target.source = "Synthetic source";
  let saves = 0;
  await page.route("**/api/v1/nutrition/protocol", (route) => {
    if (route.request().method() === "PUT") saves++;
    return route.fulfill({ json: records });
  });
  await page.goto("/nutrition?tab=protocol");
  const edit = page.getByRole("button", { name: "Edit targets", exact: true });
  await edit.click();
  await expect(
    page.getByRole("heading", { name: "Edit targets", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(edit).toBeFocused();
  await edit.click();
  await page.getByRole("button", { name: "Save targets", exact: true }).click();
  await expect(edit).toBeFocused();
  expect(saves).toBe(1);
  await expect(
    page.getByRole("region", { name: "Your protocol", exact: true }),
  ).toContainText("Revision history");
});

// Navigating from an inner detail must dismiss every ancestor sheet, not leave an overlay behind.
test("nested nutrient trend navigation closes the drawer stack", async ({
  safePage: page,
  isMobile,
}) => {
  await page.goto("/nutrition");
  const other = page.getByRole("button", {
    name: "Other nutrients",
    exact: true,
  });
  await other.click();
  await page.getByRole("button", { name: /^Cholesterol/ }).click();
  await page.getByRole("button", { name: "Show cholesterol trend" }).click();
  await expect(page).toHaveURL(/range=7d/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Trend nutrient" }),
  ).toHaveValue("Cholesterol");
});

// Review overlays in both palettes: their portals inherit theme and reduced-motion preferences.
for (const colorScheme of ["light", "dark"] as const) {
  test(`picker accessibility in ${colorScheme}`, async ({
    safePage: page,
  }, info) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/nutrition");
    await page.getByRole("button", { name: "Choose end date" }).click();
    await expect(page.getByLabel("Enter date", { exact: true })).toBeVisible();
    const violations = (
      await new AxeBuilder({ page })
        // Base UI's invisible VoiceOver focus sentinels deliberately have role=button
        // without names. Audit all application controls, excluding only these internals.
        .exclude("[data-base-ui-focus-guard]")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations;
    expect(
      violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
    if (process.env.PW_SCREENSHOTS === "1")
      await page.screenshot({
        path: info.outputPath(`synthetic-picker-${colorScheme}.png`),
      });
    await page.keyboard.press("Escape");
  });
}

// The coss Input puts className on its wrapper; hide the native date icon on
// the inner input so editable form dates have a single visible picker trigger.
test("form dates retain editing and a single calendar trigger", async ({
  safePage: page,
}, info) => {
  await page.goto("/settings");
  const input = page.getByRole("textbox", {
    name: "Date of birth",
    exact: true,
  });
  await expect(input).toHaveAttribute("type", "date");
  await expect(
    page.getByRole("button", { name: "Choose date of birth", exact: true }),
  ).toHaveCount(1);
  await input.fill("1990-01-15");
  await expect(input).toHaveValue("1990-01-15");
  if (process.env.PW_SCREENSHOTS === "1")
    await page.screenshot({ path: info.outputPath("synthetic-form-date.png") });
  await page
    .getByRole("button", { name: "Choose date of birth", exact: true })
    .click();
  await expect(page.getByLabel("Enter date", { exact: true })).toHaveValue(
    "1990-01-15",
  );
  await page.keyboard.press("Escape");
  await input.fill("");
  await expect(input).toHaveValue("");
});

// Analysis must stack below the agreed desktop breakpoint without squeezing its chart.
test("correlation panels switch from stacked to adjacent at 960px of content width", async ({
  safePage: page,
}) => {
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.goto("/correlations?x=heart_rate&y=heart_rate_variability");
  const chart = page.getByRole("region", {
    name: "Metric relationship",
    exact: true,
  });
  const analysis = page.getByRole("region", { name: "Analysis", exact: true });
  await expect(analysis).toBeVisible();
  await expect
    .poll(async () => {
      const a = await chart.boundingBox(),
        b = await analysis.boundingBox();
      return !!a && !!b && b.y >= a.y + a.height;
    })
    .toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect
    .poll(async () => {
      const a = await chart.boundingBox(),
        b = await analysis.boundingBox();
      return !!a && !!b && b.x >= a.x + a.width && Math.abs(a.y - b.y) < 2;
    })
    .toBe(true);
});
