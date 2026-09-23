import { test, expect, routes } from "./fixtures";
for (const [path, endpoint, empty] of [
  ["/", "/metrics/latest", { metrics: [], heroes: [], total_available: 0 }],
  ["/sleep", "/sleep", { sessions: [], stages: [] }],
  ["/workouts", "/workouts", []],
  ["/trends", "/metrics/latest", { metrics: [], heroes: [] }],
  ["/metrics?metric=heart_rate", "/timeseries", []],
  ["/correlations?x=heart_rate&y=heart_rate_variability", "/timeseries", []],
] as const)
  test(`loading, error, retry and empty stay distinct ${path}`, async ({
    safePage: page,
    isMobile,
  }) => {
    test.skip(
      isMobile &&
        (path.startsWith("/metrics") || path.startsWith("/correlations")),
      "Desktop-only analysis",
    );
    let state: "loading" | "error" | "empty" = "loading";
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    await page.route(`**/api/v1${endpoint}?*`, async (r) => {
      if (state === "loading") await gate;
      await r.fulfill(
        state === "empty"
          ? { json: empty }
          : { status: 503, json: { error: "Synthetic unavailable" } },
      );
    });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText("The data could not be loaded.", { exact: false }),
    ).toHaveCount(0);
    await expect(page.locator("[data-slot=empty]")).toHaveCount(0);
    await expect(
      page.locator("[data-slot=skeleton], [role=status]").first(),
    ).toBeVisible();
    state = "error";
    release();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "The data could not be loaded" }),
    ).toBeVisible({ timeout: 15000 });
    if (path === "/workouts" || path === "/trends")
      await expect(
        page.getByRole("region", { name: "Key metrics", exact: true }),
      ).toHaveCount(0);
    state = "empty";
    await page
      .getByRole("button", { name: "Retry", exact: true })
      .first()
      .click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "The data could not be loaded" }),
    ).toHaveCount(0);
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.locator("[data-slot=empty]").first()).toBeVisible();
  });
// Automatic updates must preserve loaded totals and offer Retry after a failure.
test("nutrition retains loaded totals when automatic refresh fails and recovers on retry", async ({
  safePage: page,
}) => {
  let fail = false;
  await page.route("**/api/v1/food?*", (r) =>
    r.fulfill(
      fail
        ? { status: 503, json: { error: "Synthetic offline" } }
        : { json: routes["/food"] },
    ),
  );
  await page.goto("/nutrition");
  await expect(
    page
      .locator(".nutrition-hero [data-slot=summary-value]")
      .filter({ hasText: "300" })
      .first(),
  ).toBeVisible();
  fail = true;
  // Returning to the foreground refreshes nutrition without a manual page action.
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "Showing the last loaded data" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page
      .locator(".nutrition-hero [data-slot=summary-value]")
      .filter({ hasText: "300" })
      .first(),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Showing the last loaded data" }),
  ).toHaveCount(0);
});

test("workout detail distinguishes a failed fetch from a removed workout", async ({
  safePage: page,
}) => {
  let status = 503;
  await page.route("**/api/v1/workouts/synthetic-run", (r) =>
    r.fulfill({ status, json: { error: "Synthetic response" } }),
  );
  await page.goto("/workouts/synthetic-run");
  await expect(
    page.getByRole("heading", { name: "Workout unavailable" }),
  ).toBeVisible({ timeout: 15000 });
  status = 404;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByText("This workout is no longer in the database."),
  ).toBeVisible();
  await page.getByRole("link", { name: "← Workouts" }).click();
  await expect(page).toHaveURL(/\/workouts$/);
});
