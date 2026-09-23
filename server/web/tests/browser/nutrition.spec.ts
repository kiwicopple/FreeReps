import { test, expect, protocol } from "./fixtures";
test("nested nutrient drawer closes to its parent and restores focus", async ({
  safePage: page,
  isMobile,
}) => {
  await page.goto("/nutrition");
  await page.getByText("Other nutrients", { exact: true }).click();
  // Cholesterol is deliberately absent, and must remain unknown rather than zero.
  await page.getByText("Cholesterol", { exact: true }).first().click();
  await expect(
    page.getByText("Your body uses cholesterol", { exact: false }),
  ).toBeVisible();
  {
    await expect(
      page.getByRole("dialog", { name: "Cholesterol", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close Cholesterol", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Other nutrients", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});
test("editor retains drafts on conflict, validates blanks and sends versioned payload", async ({
  safePage: page,
}) => {
  const writes: unknown[] = [];
  let fail = true;
  await page.route("**/api/v1/nutrition/protocol", async (route) => {
    if (route.request().method() === "GET") return route.fallback();
    expect(route.request().method()).toBe("PUT");
    writes.push(route.request().postDataJSON());
    await route.fulfill(
      fail
        ? {
            status: 409,
            json: { error: "Version conflict. Reload and try again." },
          }
        : { json: { protocol, version: 2 } },
    );
  });
  await page.goto("/nutrition?tab=protocol");
  await page.getByRole("button", { name: "Edit targets", exact: true }).click();
  const editor = page.getByRole("region", { name: "Edit nutrition targets" });
  await editor
    .getByLabel("Reason", { exact: true })
    .fill("Synthetic target update");
  await editor.getByRole("button", { name: "Calories · 2200 kcal" }).click();
  await editor.getByLabel("Target (kcal)", { exact: true }).fill("");
  await editor
    .getByRole("button", { name: "Save targets", exact: true })
    .click();
  expect(writes).toEqual([]);
  await editor.getByLabel("Target (kcal)", { exact: true }).fill("2300");
  await editor
    .getByLabel("Source", { exact: true })
    .first()
    .fill("Synthetic source");
  // Fill the other required source too; fixtures intentionally start blank.
  await editor.getByRole("button", { name: "Protein · 100 g" }).click();
  await editor
    .getByLabel("Source", { exact: true })
    .last()
    .fill("Synthetic source");
  await editor
    .getByRole("button", { name: "Save targets", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toContainText("Version conflict");
  await expect(editor.getByLabel("Reason", { exact: true })).toHaveValue(
    "Synthetic target update",
  );
  fail = false;
  await editor
    .getByRole("button", { name: "Save targets", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual({
    expected_version: 1,
    reason: "Synthetic target update",
    protocol: {
      ...protocol,
      effective_date: "2025-01-15",
      targets: {
        ...protocol.targets,
        energy: {
          ...protocol.targets.energy,
          value: 2300,
          source: "Synthetic source",
        },
        protein: { ...protocol.targets.protein, source: "Synthetic source" },
      },
    },
  });
});
test("cancel makes no mutation and completion uses the expected version", async ({
  safePage: page,
}) => {
  let body: unknown;
  await page.route("**/api/v1/nutrition/days/2025-01-15", async (route) => {
    expect(route.request().method()).toBe("PUT");
    body = route.request().postDataJSON();
    await route.fulfill({
      json: { date: "2025-01-15", complete: true, version: 2 },
    });
  });
  await page.goto("/nutrition?tab=protocol");
  await page.getByRole("button", { name: "Edit targets", exact: true }).click();
  await page.getByLabel("Reason", { exact: true }).fill("Unsaved");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Mark day complete", exact: true })
    .click();
  await expect
    .poll(() => body)
    .toEqual({ complete: true, expected_version: 1 });
});
test("calendar selection preserves the local day", async ({
  safePage: page,
}) => {
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Choose end date" }).click();
  await page.getByRole("button", { name: /January 10th, 2025/ }).click();
  await expect(page).toHaveURL(/date=2025-01-10/);
  await expect(
    page.getByRole("button", { name: "Choose end date" }),
  ).toContainText("2025-01-10");
});
// Changing comparison modes must preserve their distinct server payloads.
for (const kind of ["goal", "range", "maximum", "reference"])
  test(`nutrition target comparison ${kind}`, async ({ safePage: page }) => {
    const base = {
      ...protocol,
      targets: {
        energy: { ...protocol.targets.energy, source: "Synthetic source" },
      },
    };
    let saved: any;
    await page.route("**/api/v1/nutrition/protocol", async (r) => {
      if (r.request().method() === "GET")
        return r.fulfill({
          json: [
            {
              protocol: base,
              version: 3,
              reason: "Synthetic",
              recorded_at: "2025-01-01T00:00:00Z",
            },
          ],
        });
      expect(r.request().method()).toBe("PUT");
      saved = r.request().postDataJSON();
      await r.fulfill({ json: { protocol: base, version: 4 } });
    });
    await page.goto("/nutrition?tab=protocol");
    await page
      .getByRole("button", { name: "Edit targets", exact: true })
      .click();
    const editor = page.getByRole("region", { name: "Edit nutrition targets" });
    await editor.getByRole("button", { name: "Calories · 2200 kcal" }).click();
    await editor.getByRole("combobox", { name: "Comparison" }).click();
    await page
      .getByRole("option", {
        name: {
          goal: "Goal",
          range: "Range",
          maximum: "Planning maximum",
          reference: "Reference only",
        }[kind],
        exact: true,
      })
      .click();
    if (kind === "range") {
      await editor.getByLabel("Range low").fill("2000");
      await editor.getByLabel("Range high").fill("2500");
    }
    await editor
      .getByRole("button", { name: "Save targets", exact: true })
      .click();
    await expect.poll(() => saved?.expected_version).toBe(3);
    expect(saved.protocol.targets.energy).toEqual({
      ...base.targets.energy,
      kind,
      ...(kind === "range" ? { low: 2000, high: 2500 } : {}),
    });
  });

test("nutrition period totals, trend selection, food details and protocol history remain reachable", async ({
  safePage: page,
  isMobile,
}) => {
  const urls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/food?")) urls.push(r.url());
  });
  await page.goto("/nutrition");
  await expect(
    page.locator(".nutrition-hero [data-slot=summary-value]").first(),
  ).toHaveText("300 kcal");
  await page.getByText("Calories", { exact: true }).first().click();
  await expect(
    page.getByRole("link", { name: /Learn more about calories/ }),
  ).toHaveAttribute("href", /^https:/);
  await page.getByRole("button", { name: "Show calories trend" }).click();
  await expect(page).toHaveURL(/range=7d/);
  await expect(
    page.getByRole("combobox", { name: "Trend nutrient" }),
  ).toHaveValue("Calories");
  expect(
    urls.some(
      (url) =>
        url.includes("start=2025-01-09") && url.includes("end=2025-01-16"),
    ),
  ).toBe(true);
  if (isMobile) {
    await page
      .getByRole("button", { name: "Last 7 days", exact: true })
      .click();
    await page
      .getByRole("radio", { name: "Last 30 days", exact: true })
      .click();
  } else await page.getByRole("radio", { name: "30d", exact: true }).click();
  await expect(page).toHaveURL(/range=30d/);
  await expect
    .poll(() =>
      urls.some(
        (url) =>
          url.includes("start=2024-12-17") && url.includes("end=2025-01-16"),
      ),
    )
    .toBe(true);
  const nutrient = page.getByRole("combobox", { name: "Trend nutrient" });
  await nutrient.fill("Protein");
  await page.getByRole("option", { name: "Protein", exact: true }).click();
  await expect(nutrient).toHaveValue("Protein");
  await page.getByRole("button", { name: "2025-01-15", exact: true }).click();
  await expect(page).toHaveURL(/range=day/);
  await page.getByRole("tab", { name: "Protocol", exact: true }).click();
  await expect(
    page.getByText("Version 1 · effective 2025-01-01 · Synthetic"),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Food log", exact: true }).click();
  await page.getByRole("button", { name: /Breakfast/ }).click();
  await expect(
    page.getByText("Synthetic fixture", { exact: true }),
  ).toBeVisible();
});

test("nutrition profile edits and target addition and removal preserve the payload", async ({
  safePage: page,
}) => {
  const base = { ...protocol, targets: {} };
  let saved: any;
  await page.route("**/api/v1/nutrition/protocol", async (r) => {
    if (r.request().method() === "GET")
      return r.fulfill({
        json: [
          {
            protocol: base,
            version: 5,
            reason: "Synthetic",
            recorded_at: "2025-01-01T00:00:00Z",
          },
        ],
      });
    saved = r.request().postDataJSON();
    await r.fulfill({ json: { protocol: base, version: 6 } });
  });
  await page.goto("/nutrition?tab=protocol");
  await page.getByRole("button", { name: "Edit targets" }).click();
  const editor = page.getByRole("region", { name: "Edit nutrition targets" });
  await editor.getByRole("button", { name: "Profile and preferences" }).click();
  await editor.getByLabel("age", { exact: true }).fill("35");
  await editor.getByLabel("height cm", { exact: true }).fill("180");
  await editor.getByLabel("weight kg", { exact: true }).fill("80");
  await editor.getByLabel("Food preferences").fill("Synthetic preference");
  await editor
    .getByLabel("Activity", { exact: true })
    .fill("Synthetic activity");
  await editor.getByLabel("Goal", { exact: true }).fill("Synthetic goal");
  await editor.getByRole("combobox", { name: "Reference sex" }).click();
  await page.getByRole("option", { name: "Female", exact: true }).click();
  const add = editor.getByRole("combobox", { name: "Nutrient to add" });
  await add.fill("Fiber");
  await page.getByRole("option", { name: "Fiber", exact: true }).click();
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  const fiber = editor.getByRole("button", { name: "Fiber · 1 g" });
  await fiber.click();
  const fiberPanel = page.locator(
    `[id="${await fiber.getAttribute("aria-controls")}"]`,
  );
  // WebKit may scroll between pointerdown/up while this height transition runs.
  await expect(fiberPanel).not.toHaveAttribute("data-starting-style", "");
  await fiberPanel.evaluate(async (panel) => {
    await Promise.all(
      panel.getAnimations().map((animation) => animation.finished),
    );
  });
  await editor.getByRole("button", { name: "Remove target" }).click();
  await expect(fiber).toHaveCount(0);
  await add.fill("Protein");
  await page.getByRole("option", { name: "Protein", exact: true }).click();
  await editor.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    editor.getByRole("button", { name: "Protein · 1 g" }),
  ).toBeVisible();
  await expect(editor.getByRole("button", { name: "Fiber · 1 g" })).toHaveCount(
    0,
  );
  await editor.getByRole("button", { name: "Save targets" }).click();
  await expect.poll(() => saved?.expected_version).toBe(5);
  expect(saved.protocol.profile).toEqual({
    age: 35,
    sex: "female",
    height_cm: 180,
    weight_kg: 80,
    preferences: "Synthetic preference",
    activity: "Synthetic activity",
    goal: "Synthetic goal",
  });
  expect(saved.protocol.targets).toEqual({
    protein: {
      value: 1,
      unit: "g",
      kind: "goal",
      label: "Personal planning target",
      source: "User-defined target",
    },
  });
});
