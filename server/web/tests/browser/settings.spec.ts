import { test, expect, routes } from "./fixtures";
const sections = [
  ["identity", "Identity"],
  ["sources", "Sources"],
  ["oura", "Oura"],
  ["withings", "Withings"],
  ["hevy", "Hevy"],
  ["front-page", "Front page"],
  ["ingest", "Ingest"],
  ["import", "Import"],
  ["alerts", "Alerts"],
];
test("all nine settings sections and tab URLs remain available", async ({
  safePage: page,
  isMobile,
}) => {
  await page.goto("/settings?tab=sources");
  for (const [id, label] of sections) {
    if (!isMobile) {
      await page.getByRole("tab", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp("tab=" + id));
      await expect(
        page.getByRole("tabpanel", { name: label, exact: true }),
      ).toBeVisible();
    } else
      await expect(
        page.getByRole("region", { name: label, exact: true }),
      ).toBeVisible();
  }
});
test("identity saves and clears birth date and overrides and resets maximum HR", async ({
  safePage: page,
}) => {
  let birth = "",
    bpm = 0;
  const writes: unknown[] = [];
  await page.route("**/api/v1/preferences/birth-date", async (r) => {
    if (r.request().method() === "PUT") {
      expect(r.request().method()).toBe("PUT");
      const body = r.request().postDataJSON();
      writes.push(body);
      birth = body.birth_date;
    }
    await r.fulfill({ json: { birth_date: birth } });
  });
  await page.route("**/api/v1/preferences/max-heart-rate", async (r) => {
    if (r.request().method() === "PUT") {
      const body = r.request().postDataJSON();
      writes.push(body);
      bpm = body.bpm;
    }
    await r.fulfill({
      json: {
        bpm: bpm || 180,
        observed: 170,
        estimated: 180,
        origin: bpm ? "configured" : "estimated",
      },
    });
  });
  await page.goto("/settings");
  await page.getByLabel("Date of birth", { exact: true }).fill("1990-01-15");
  const birthRow = page
    .getByLabel("Date of birth", { exact: true })
    .locator('xpath=ancestor::*[@data-slot="field"][1]');
  await birthRow.getByRole("button", { name: "Save", exact: true }).click();
  await birthRow.getByRole("button", { name: "Clear", exact: true }).click();
  const max = page.getByLabel("Maximum heart rate in bpm");
  await max.fill("190");
  const maxRow = max.locator('xpath=ancestor::*[@data-slot="field"][1]');
  await maxRow.getByRole("button", { name: "Save", exact: true }).click();
  await maxRow
    .getByRole("button", { name: "Use automatic", exact: true })
    .click();
  expect(writes).toEqual([
    { birth_date: "1990-01-15" },
    { birth_date: "" },
    { bpm: 190 },
    { bpm: 0 },
  ]);
});
for (const provider of ["oura", "withings", "hevy"])
  test(`${provider} credentials, sync and disconnect retain exact requests`, async ({
    safePage: page,
    isMobile,
  }) => {
    let configured = false;
    const calls: { method: string; path: string; body: unknown }[] = [];
    await page.route(`**/api/v1/${provider}/*`, async (r) => {
      const path = new URL(r.request().url()).pathname.split("/").pop()!;
      if (path === "status")
        return r.fulfill({
          json: {
            configured,
            connected: configured,
            redirect_uri: `https://example.invalid/${provider}/callback`,
          },
        });
      calls.push({
        method: r.request().method(),
        path,
        body: r.request().postData() ? r.request().postDataJSON() : null,
      });
      if (path === "credentials") configured = true;
      if (path === "disconnect") configured = false;
      await r.fulfill({ json: {} });
    });
    await page.goto("/settings?tab=" + provider);
    const label =
      provider === "oura" ? "Oura" : provider === "hevy" ? "Hevy" : "Withings";
    const panel = page.getByRole(isMobile ? "region" : "tabpanel", {
      name: label,
      exact: true,
    });
    if (provider === "hevy") {
      await panel.getByLabel("API key", { exact: true }).fill("synthetic-key");
      await panel.locator('input[type="date"]').fill("2024-01-01");
      await panel.getByRole("button", { name: /Save/ }).click();
    } else {
      await panel
        .getByLabel("Client ID", { exact: true })
        .fill("synthetic-client");
      await panel
        .getByLabel("Client secret", { exact: true })
        .fill("synthetic-secret");
      await panel.getByRole("button", { name: "Save credentials" }).click();
    }
    await panel.getByRole("button", { name: "Sync now", exact: true }).click();
    await panel
      .getByRole("button", { name: "Disconnect", exact: true })
      .click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect(calls.filter((c) => c.path === "disconnect")).toEqual([]);
    await panel
      .getByRole("button", { name: "Disconnect", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Disconnect", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(calls).toEqual([
      {
        method: "PUT",
        path: "credentials",
        body:
          provider === "hevy"
            ? { api_key: "synthetic-key", sync_from: "2024-01-01" }
            : {
                client_id: "synthetic-client",
                client_secret: "synthetic-secret",
              },
      },
      { method: "POST", path: "sync", body: null },
      { method: "DELETE", path: "disconnect", body: null },
    ]);
  });
test("sources reorder and remove overrides with unchanged payloads", async ({
  safePage: page,
  isMobile,
}) => {
  const writes: unknown[] = [];
  await page.route("**/api/v1/source-priority**", async (r) => {
    if (r.request().method() === "GET")
      return r.fulfill({
        json: {
          ...(routes["/source-priority"] as object),
          rules: [{ category: "sleep", sources: ["Synthetic Watch", ""] }],
        },
      });
    writes.push({
      method: r.request().method(),
      path: new URL(r.request().url()).pathname,
      body: r.request().postData() ? r.request().postDataJSON() : null,
    });
    await r.fulfill({ json: {} });
  });
  await page.goto("/settings?tab=sources");
  const panel = page.getByRole(isMobile ? "region" : "tabpanel", {
    name: "Sources",
    exact: true,
  });
  await panel
    .getByRole("button", { name: "Move Synthetic Watch down" })
    .click();
  await panel.getByRole("button", { name: /Save/ }).click();
  await panel.getByRole("button", { name: "Remove", exact: true }).click();
  expect(writes).toEqual([
    {
      method: "PUT",
      path: "/api/v1/source-priority",
      body: { category: "_default", sources: ["", "Synthetic Watch"] },
    },
    { method: "DELETE", path: "/api/v1/source-priority/sleep", body: null },
  ]);
});
test("alerts save uses seconds and test action is mocked", async ({
  safePage: page,
  isMobile,
}) => {
  const calls: unknown[] = [];
  let settings = {
    enabled: false,
    ntfy_url: "",
    hostname: "synthetic",
    check_interval_sec: 60,
    failure_threshold: 3,
    apple_silence_sec: 0,
  };
  await page.route("**/api/v1/alerts**", async (r) => {
    if (r.request().method() === "GET")
      return r.fulfill({ json: { settings, conditions: [] } });
    if (r.request().method() === "PUT") settings = r.request().postDataJSON();
    calls.push({
      method: r.request().method(),
      path: new URL(r.request().url()).pathname,
      body: r.request().postData() ? r.request().postDataJSON() : null,
    });
    await r.fulfill({ json: {} });
  });
  await page.goto("/settings?tab=alerts");
  const panel = page.getByRole(isMobile ? "region" : "tabpanel", {
    name: "Alerts",
    exact: true,
  });
  await panel.getByRole("switch").click();
  await panel
    .getByLabel("ntfy topic URL")
    .fill("https://example.invalid/test-topic");
  await panel.getByLabel("Check interval in minutes").fill("5");
  await panel.getByRole("button", { name: /Save/ }).click();
  await panel.getByRole("button", { name: /Send test/ }).click();
  expect(calls).toEqual([
    {
      method: "PUT",
      path: "/api/v1/alerts",
      body: {
        enabled: true,
        ntfy_url: "https://example.invalid/test-topic",
        hostname: "synthetic",
        check_interval_sec: 300,
        failure_threshold: 3,
        apple_silence_sec: 0,
      },
    },
    { method: "POST", path: "/api/v1/alerts/test", body: null },
  ]);
});
test("import selection removal, failed upload and retry preserve the file", async ({
  safePage: page,
  isMobile,
}) => {
  let calls = 0;
  await page.route("**/api/v1/ingest/alpha", async (r) => {
    expect(r.request().method()).toBe("POST");
    expect(r.request().headers()["content-type"]).toBe("text/csv");
    if (r.request().postData() !== null)
      expect(r.request().postData()).toContain("Synthetic exercise");
    calls++;
    await r.fulfill(
      calls === 1
        ? { status: 400, json: { error: "Synthetic rejected upload" } }
        : { json: { sets_received: 2, sets_inserted: 1 } },
    );
  });
  await page.goto("/settings?tab=import");
  const panel = page.getByRole(isMobile ? "region" : "tabpanel", {
    name: "Import",
    exact: true,
  });
  const file = {
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("exercise,reps\nSynthetic exercise,5"),
  };
  await panel.locator("input[type=file]").setInputFiles(file);
  await panel.getByRole("button", { name: "Remove" }).click();
  await expect(
    panel.getByRole("button", { name: "Upload", exact: true }),
  ).toHaveCount(0);
  await panel.locator("input[type=file]").setInputFiles(file);
  await panel.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(panel.getByRole("alert")).toBeVisible();
  await panel.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(panel.getByText("Upload complete")).toBeVisible();
  expect(calls).toBe(2);
});
// Hero order is selection order; save/reset must not silently replace visibility.
test("front-page visibility, hero limit, selection order, save and reset", async ({
  safePage: page,
  isMobile,
}) => {
  const names = ["one", "two", "three", "four", "five"];
  const writes: unknown[] = [];
  await page.route("**/api/v1/metrics/available", (r) =>
    r.fulfill({
      json: names.map((name) => ({
        metric_name: name,
        display_label: name,
        display_unit: "count",
        category: "activity",
        is_cumulative: true,
        display_multiplier: 1,
        visible: true,
      })),
    }),
  );
  await page.route("**/api/v1/metrics/latest?*", (r) =>
    r.fulfill({
      json: {
        ...(routes["/metrics/latest"] as object),
        heroes: names.slice(0, 4),
      },
    }),
  );
  await page.route("**/api/v1/metrics/visibility", async (r) => {
    expect(r.request().method()).toBe("PUT");
    writes.push(r.request().postDataJSON());
    await r.fulfill({ json: {} });
  });
  await page.route("**/api/v1/preferences/front-page-heroes", async (r) => {
    expect(r.request().method()).toBe("PUT");
    writes.push(r.request().postDataJSON());
    await r.fulfill({ json: {} });
  });
  await page.goto("/settings?tab=front-page");
  const panel = page.getByRole(isMobile ? "region" : "tabpanel", {
    name: "Front page",
    exact: true,
  });
  await expect(
    panel.getByRole("button", { name: "Make hero", exact: true }),
  ).toBeDisabled();
  await panel
    .getByRole(isMobile ? "switch" : "checkbox", { name: "List one" })
    .click();
  await panel.getByRole("button", { name: "one ×", exact: true }).click();
  await panel
    .getByRole("button", { name: "Make hero", exact: true })
    .last()
    .click();
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes).toEqual([
    { one: false, two: true, three: true, four: true, five: true },
    ["two", "three", "four", "five"],
  ]);
  await panel.getByRole("button", { name: "Reset to defaults" }).click();
  await expect(
    panel.getByRole(isMobile ? "switch" : "checkbox", { name: "List one" }),
  ).toBeChecked();
});
for (const provider of ["oura", "withings"])
  test(`${provider} authorization uses the registered connection flow`, async ({
    safePage: page,
    isMobile,
  }) => {
    let count = 0;
    await page.route(`**/api/v1/${provider}/status`, (r) =>
      r.fulfill({
        json: {
          configured: true,
          connected: false,
          redirect_uri: `https://example.invalid/${provider}/callback`,
        },
      }),
    );
    await page.route(`**/api/v1/${provider}/authorize`, async (r) => {
      expect(r.request().method()).toBe("POST");
      count++;
      await r.fulfill({
        json: {
          authorize_url: `http://127.0.0.1:4173/settings?tab=${provider}&synthetic_authorized=true`,
        },
      });
    });
    await page.goto("/settings?tab=" + provider);
    const panel = page.getByRole(isMobile ? "region" : "tabpanel", {
      name: provider === "oura" ? "Oura" : "Withings",
      exact: true,
    });
    await expect(panel.getByLabel("Redirect URI")).toHaveValue(
      `https://example.invalid/${provider}/callback`,
    );
    await panel.getByRole("button", { name: /Authorize with/ }).click();
    await expect(page).toHaveURL(/synthetic_authorized=true/);
    expect(count).toBe(1);
  });

for (const [tab, label, path] of [
  ["identity", "Identity", "/stats"],
  ["sources", "Sources", "/source-priority"],
  ["front-page", "Front page", "/metrics/available"],
  ["ingest", "Ingest", "/import-logs"],
  ["oura", "Oura", "/oura/status"],
  ["withings", "Withings", "/withings/status"],
  ["hevy", "Hevy", "/hevy/status"],
  ["alerts", "Alerts", "/alerts"],
])
  test(`${label} load failures stay actionable and retry`, async ({
    safePage: page,
    isMobile,
  }) => {
    let fail = true;
    await page.route(`**/api/v1${path}*`, (r) =>
      r.fulfill(
        fail
          ? { status: 503, json: { error: "Synthetic unavailable" } }
          : { json: routes[path] },
      ),
    );
    await page.goto("/settings?tab=" + tab);
    const panel = page.getByRole(isMobile ? "region" : "tabpanel", {
      name: label,
      exact: true,
    });
    await expect(panel.getByRole("alert")).toBeVisible({ timeout: 15000 });
    fail = false;
    await panel.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(panel.getByRole("alert")).toHaveCount(0);
  });

test("populated integrations and ingest logs fit a narrow phone", async ({
  safePage: page,
  isMobile,
}) => {
  for (const provider of ["oura", "withings", "hevy"])
    await page.route(`**/api/v1/${provider}/status`, (r) =>
      r.fulfill({
        json: {
          configured: true,
          connected: true,
          client_id: "synthetic-client",
          redirect_uri: `https://example.invalid/${provider}/callback`,
          sync_from: "2024-01-01",
          sync_states: { sleep: "2025-01-15T00:00:00Z" },
        },
      }),
    );
  await page.route("**/api/v1/import-logs*", (r) =>
    r.fulfill({
      json: [
        {
          id: 1,
          created_at: "2025-01-15T00:00:00Z",
          source: "Synthetic Watch",
          status: "success",
          metrics_inserted: 100,
          workouts_inserted: 1,
          sleep_sessions: 1,
          sets_inserted: 1,
        },
      ],
    }),
  );
  await page.goto("/settings?tab=ingest");
  if (!isMobile) await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByText("100 metrics · 1 workouts · 1 nights · 1 sets"),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(320);
});

test("empty alert numbers stay empty and prevent saving", async ({
  safePage: page,
  isMobile,
}) => {
  await page.goto("/settings?tab=alerts");
  const panel = page.getByRole(isMobile ? "region" : "tabpanel", {
    name: "Alerts",
    exact: true,
  });
  const interval = panel.getByLabel("Check interval in minutes");
  await interval.fill("");
  await expect(interval).toHaveValue("");
  await expect(
    panel.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await interval.fill("5");
  await expect(
    panel.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();
});
