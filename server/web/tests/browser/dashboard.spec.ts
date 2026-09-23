import { test, expect, routes, metric, protocol, workout } from "./fixtures";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function settingsSection(page: Page, label: string) {
  await expect(page.getByRole("tabpanel")).toBeVisible();
  const tab = page.getByRole("tab", { name: label, exact: true });
  if (await tab.isVisible()) await tab.click();
  else {
    await page.getByRole("combobox", { name: "Settings section" }).click();
    await page.getByRole("option", { name: label, exact: true }).click();
  }
  await expect(
    page.getByRole("tabpanel", { name: label, exact: true }),
  ).toBeVisible();
}

// Collapsing changes only the chrome; navigation and the preference survive reload/resize.
test("sidebar preference and mobile More preserve navigation", async ({
  safePage: page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const sidebar = page.getByRole("complementary", {
    name: "Application sidebar",
  });
  await expect(sidebar).toHaveCSS("width", "224px");
  const collapse = page.getByRole("button", { name: "Collapse sidebar" });
  await collapse.focus();
  await page.keyboard.press("Enter");
  await expect(sidebar).toHaveCSS("width", "64px");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("protocol.sidebar.collapsed"),
    ),
  ).toBe("true");
  await page.reload();
  await expect(sidebar).toHaveCSS("width", "64px");
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(sidebar).toHaveCSS("width", "64px");
  await expect(
    page.getByRole("button", { name: /Collapse sidebar/ }),
  ).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  const more = nav.getByRole("button", { name: "More", exact: true });
  await more.click();
  const drawer = page.getByRole("dialog", { name: "More", exact: true });
  await expect(
    drawer.getByRole("link", { name: "Trends", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await more.click();
  await drawer.getByRole("link", { name: "Trends", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/\/trends$/);
  await expect(more).toHaveAttribute("data-active", "true");
  await page.goBack();
  await expect(
    nav.getByRole("link", { name: "Today", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await more.click();
  await drawer.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

// Search narrows loaded rows without changing configured heroes or fetching hidden metrics.
test("Today searches loaded metrics and retains category groups", async ({
  safePage: page,
}) => {
  const available = [
    metric,
    {
      ...metric,
      metric_name: "steps",
      label: "Steps",
      category: "activity",
      unit: "count",
      latest: 0,
    },
  ];
  let requests = 0;
  await page.route("**/api/v1/metrics/latest?*", (r) => {
    requests++;
    return r.fulfill({
      json: {
        ...(routes["/metrics/latest"] as object),
        metrics: available,
        total_available: 99,
      },
    });
  });
  await page.goto("/");
  const section = page.getByRole("region", {
    name: "All metrics",
    exact: true,
  });
  const search = section.getByRole("textbox", { name: "Search metrics" });
  await expect(section.getByText("Steps", { exact: true })).toBeVisible();
  await search.fill("steps");
  await expect(section.getByText("Steps", { exact: true })).toBeVisible();
  await expect(section.getByText("Heart Rate", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Key metrics" }).getByText("60 bpm"),
  ).toBeVisible();
  await search.fill("unrecorded");
  await expect(section.getByText("No matching metrics.")).toBeVisible();
  await section
    .getByRole("button", { name: "Clear search", exact: true })
    .last()
    .click();
  await expect(section.getByText("Heart Rate", { exact: true })).toBeVisible();
  expect(requests).toBe(1);
  await section.getByRole("link", { name: "Customize metrics" }).click();
  await expect(page).toHaveURL(/settings\?tab=front-page/);
});

// Date/range/tab history must compose, rather than overwrite each other's query keys.
test("nutrition tabs retain date range and unrelated URL parameters", async ({
  safePage: page,
  isMobile,
}) => {
  await page.goto(
    "/nutrition?tab=food-log&date=2025-01-15&range=7d&keep=synthetic",
  );
  await expect(
    page.getByRole("tab", { name: "Food log", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(page).toHaveURL(/date=2025-01-14/);
  expect(new URL(page.url()).searchParams.get("tab")).toBe("food-log");
  if (isMobile) {
    await page
      .getByRole("button", { name: "Last 7 days", exact: true })
      .click();
    await page
      .getByRole("radio", { name: "Last 30 days", exact: true })
      .click();
  } else await page.getByRole("radio", { name: "30d", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("tab")).toBe("food-log");
  await page.getByRole("tab", { name: "Protocol", exact: true }).click();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "Protocol", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goForward();
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({
    tab: "overview",
    date: "2025-01-14",
    range: "30d",
    keep: "synthetic",
  });
  await page.goto("/nutrition?tab=invalid");
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

// A background revision must not silently rebase an open editor or discard a hidden draft.
test("nutrition editor keeps its snapshot across tabs refreshes and responsive changes", async ({
  safePage: page,
}) => {
  let version = 1,
    reads = 0;
  let saved: any;
  const original = structuredClone(protocol);
  for (const target of Object.values(original.targets))
    target.source = "Synthetic source";
  await page.route("**/api/v1/nutrition/protocol", (r) => {
    if (r.request().method() === "PUT") {
      saved = r.request().postDataJSON();
      return r.fulfill({
        status: 409,
        json: { error: "Synthetic version conflict" },
      });
    }
    reads++;
    return r.fulfill({
      json: [
        {
          protocol: {
            ...original,
            notes:
              version === 1 ? "Original snapshot" : "New background revision",
          },
          version,
          reason: "Synthetic",
          recorded_at: "2025-01-01T00:00:00Z",
        },
      ],
    });
  });
  await page.goto("/nutrition?tab=protocol");
  await page.getByRole("button", { name: "Edit targets", exact: true }).click();
  await page.getByLabel("Reason", { exact: true }).fill("Retained draft");
  await page.getByRole("tab", { name: "Food log", exact: true }).click();
  await expect(page.getByLabel("Reason", { exact: true })).toBeHidden();
  version = 2;
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await expect.poll(() => reads).toBeGreaterThan(1);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.getByRole("tab", { name: "Protocol", exact: true }).click();
  await expect(page.getByLabel("Reason", { exact: true })).toHaveValue(
    "Retained draft",
  );
  await page.getByRole("button", { name: "Save targets", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Synthetic version conflict",
  );
  expect(saved.expected_version).toBe(1);
  expect(saved.protocol.notes).toBe("Original snapshot");
  await expect(page.getByLabel("Reason", { exact: true })).toHaveValue(
    "Retained draft",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit targets", exact: true }),
  ).toBeFocused();
});

// Sheets belong to their date/tab context and trend actions dismiss every nested overlay.
test("detail sheets close on history changes and trend navigation focuses Overview", async ({
  safePage: page,
}) => {
  await page.goto("/nutrition?tab=overview");
  await page.getByRole("tab", { name: "Food log", exact: true }).click();
  await page.getByRole("button", { name: /Breakfast/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Other nutrients", exact: true })
    .click();
  await page.getByRole("button", { name: /^Cholesterol/ }).click();
  await page.getByRole("button", { name: "Show cholesterol trend" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("combobox", { name: "Trend nutrient" }),
  ).toHaveValue("Cholesterol");
  await expect(page.locator("#nutrition-trend")).toBeFocused();
});

// Inactive settings cannot participate in keyboard navigation or lose unsaved secrets on resize.
test("settings drafts remain in memory across sections and breakpoints", async ({
  safePage: page,
}) => {
  await page.goto("/settings?tab=oura&keep=synthetic");
  await page.getByLabel("Client ID", { exact: true }).fill("unsaved-client");
  await page
    .getByLabel("Client secret", { exact: true })
    .fill("synthetic-secret-draft");
  await settingsSection(page, "Identity");
  await page.getByLabel("Date of birth", { exact: true }).fill("1990-01-15");
  await page.setViewportSize({ width: 768, height: 900 });
  await settingsSection(page, "Alerts");
  await page.getByLabel("Reported as", { exact: false }).fill("unsaved-host");
  await settingsSection(page, "Oura");
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page.getByLabel("Client ID", { exact: true })).toHaveValue(
    "unsaved-client",
  );
  await expect(page.getByLabel("Client secret", { exact: true })).toHaveValue(
    "synthetic-secret-draft",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await settingsSection(page, "Identity");
  await expect(page.getByLabel("Date of birth", { exact: true })).toHaveValue(
    "1990-01-15",
  );
  await settingsSection(page, "Alerts");
  await expect(page.getByLabel("Reported as", { exact: false })).toHaveValue(
    "unsaved-host",
  );
  expect(new URL(page.url()).searchParams.get("keep")).toBe("synthetic");
  expect(
    await page.evaluate(
      () => JSON.stringify(localStorage) + JSON.stringify(sessionStorage),
    ),
  ).not.toContain("synthetic-secret-draft");
});

// The copy helper must copy the exact registered value and leave a manual fallback on failure.
test("redirect URI copies exactly and offers an accessible fallback", async ({
  safePage: page,
}) => {
  await page.goto("/settings?tab=oura");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as any).copiedURI = value;
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Copy redirect URI" }).click();
  expect(await page.evaluate(() => (window as any).copiedURI)).toBe(
    "https://example.invalid/oura/callback",
  );
  await expect(page.getByText("Copied", { exact: true })).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw Error("Denied");
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Copy redirect URI" }).click();
  await expect(
    page.getByText("Copy failed. Select the address and copy it manually."),
  ).toBeVisible();
});

// Pending mutations survive a section switch without duplicate submissions.
test("pending integration sync and credential menu retain independent actions", async ({
  safePage: page,
}) => {
  let release!: () => void,
    calls = 0;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/oura/status", (r) =>
    r.fulfill({
      json: {
        configured: true,
        connected: true,
        client_id: "synthetic-client",
        redirect_uri: "https://example.invalid/oura/callback",
      },
    }),
  );
  await page.route("**/api/v1/oura/sync", async (r) => {
    calls++;
    await pending;
    await r.fulfill({ json: {} });
  });
  await page.goto("/settings?tab=oura");
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Syncing…/ })).toBeDisabled();
  await settingsSection(page, "Identity");
  await settingsSection(page, "Oura");
  await expect(page.getByRole("button", { name: /^Syncing…/ })).toBeDisabled();
  release();
  await expect(
    page.getByRole("button", { name: "Sync now", exact: true }),
  ).toBeEnabled();
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "Manage Oura" }).click();
  await page.getByRole("menuitem", { name: "Edit credentials" }).click();
  await expect(page.getByLabel("Client ID", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Manage Oura" })).toBeFocused();
});

// A real file button avoids the old nested interactive drop zone.
test("import Browse opens file selection and Remove stays separate", async ({
  safePage: page,
}) => {
  await page.goto("/settings?tab=import");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Browse CSV files" }).click();
  await (
    await chooser
  ).setFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("exercise,reps\nSynthetic exercise,5"),
  });
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toBeVisible();
  expect(
    await page.locator("button button, [role=button] button").count(),
  ).toBe(0);
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Upload", exact: true }),
  ).toHaveCount(0);
});

// Test each viewport/theme independently: all 54 selections in one test can
// exhaust the CI time limit before reaching later panels, hiding real failures.
for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [320, 768, 1440]) {
    test(`settings panels fit ${width}px in ${colorScheme}`, async ({
      safePage: page,
    }, info) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/settings");
      for (const label of [
        "Identity",
        "Sources",
        "Oura",
        "Withings",
        "Hevy",
        "Front page",
        "Ingest",
        "Import",
        "Alerts",
      ]) {
        await settingsSection(page, label);
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(width);
      }
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(
        audit.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact ?? ""),
        ),
      ).toEqual([]);
      if (process.env.PW_SCREENSHOTS === "1")
        await page.screenshot({
          path: info.outputPath(
            `synthetic-settings-${width}-${colorScheme}.png`,
          ),
        });
    });
  }
}

// Supplement shortcuts must expose the same estimates and sources as their food-log record.
test("supplements open scrolling details on both layouts", async ({
  safePage: page,
}) => {
  const food = structuredClone(routes["/food"]) as any;
  food.entries[0].entry.items.push({
    name: "Synthetic supplement",
    kind: "supplement",
    portion: "one serving",
    assumptions: "Synthetic estimate",
    nutrients: {
      vitamin_d: {
        value: 10,
        unit: "mcg",
        basis: "Synthetic label",
        confidence: "reported",
        reference: "https://example.invalid/synthetic-label",
      },
    },
  });
  await page.route("**/api/v1/food?*", (r) => r.fulfill({ json: food }));
  await page.goto("/nutrition?tab=food-log");
  const trigger = page.getByRole("button", { name: /^Synthetic supplement/ });
  await trigger.click();
  const sheet = page.getByRole("dialog", {
    name: "Synthetic supplement",
    exact: true,
  });
  await expect(sheet.getByText("Synthetic estimate")).toBeVisible();
  await expect(sheet.getByText("Vitamin D", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("link")).toHaveAttribute(
    "href",
    "https://example.invalid/synthetic-label",
  );
  await sheet
    .getByRole("button", { name: "Close Synthetic supplement" })
    .click();
  await expect(trigger).toBeFocused();
});

// An empty detail must wait for the exercised-sets request, rather than flash during loading.
test("workout empty details wait for successful requests", async ({
  safePage: page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/workouts/synthetic-run", (r) =>
    r.fulfill({
      json: {
        ...workout,
        Name: "Traditional Strength Training",
        HeartRateData: [],
        RouteData: [],
      },
    }),
  );
  await page.route("**/api/v1/workouts/synthetic-run/sets*", async (r) => {
    await pending;
    await r.fulfill({ json: [] });
  });
  await page.goto("/workouts/synthetic-run");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    /Strength/,
  );
  const empty = page.getByText(
    "No exercise, heart-rate or route details were recorded for this workout.",
  );
  await expect(empty).toHaveCount(0);
  release();
  await expect(empty).toBeVisible();
});
