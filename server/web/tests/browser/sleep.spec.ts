import { test, expect, night } from "./fixtures";
test("night selection refreshes the HR window and excludes the selected night from its baseline", async ({
  safePage: page,
}) => {
  const urls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/v1/")) urls.push(req.url());
  });
  await page.goto("/sleep");
  const overlay = page.getByRole("img", {
    name: /Heart rate in five-minute averages/,
  });
  await expect(overlay).toBeVisible();
  await expect(
    page.getByText("Lowest 5-minute average: 60 bpm", { exact: false }),
  ).toBeVisible();
  await page.getByRole("switch", { name: "Heart rate", exact: true }).click();
  await expect(overlay).toHaveCount(0);
  await page.getByRole("switch", { name: "Heart rate", exact: true }).click();
  await expect(overlay).toBeVisible();
  expect(
    urls.some((url) => {
      const u = new URL(url);
      return (
        u.pathname.endsWith("/timeseries") &&
        u.searchParams.get("start") === night.SleepStart &&
        u.searchParams.get("end") === night.SleepEnd
      );
    }),
  ).toBe(true);
  expect(
    urls.some((url) => {
      const u = new URL(url);
      return (
        u.pathname.endsWith("/sleep") &&
        u.searchParams.get("start") === "2024-12-17" &&
        u.searchParams.get("end") === "2025-01-13"
      );
    }),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Contributors & how it works" })
    .click();
  await expect(
    page.getByText("Duration = hours asleep", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Choose night date" }).click();
  await page.getByLabel("Enter date", {exact: true}).fill("2025-01-12");
  await page.getByRole("button", {name: "Apply", exact: true}).click();
  await expect(page).toHaveURL(/date=2025-01-12/);
  await expect(
    page.getByText("No sleep recorded for this date.", { exact: false }),
  ).toBeVisible();
});
test("heart-rate gaps remain separate chart segments", async ({
  safePage: page,
}) => {
  await page.route("**/api/v1/timeseries?*", (r) =>
    r.fulfill({
      json: [
        { time: night.SleepStart, avg: 60 },
        { time: "2025-01-14T16:00:00Z", avg: 55 },
      ],
    }),
  );
  await page.goto("/sleep");
  const chart = page.getByRole("img", {
    name: /Heart rate in five-minute averages/,
  });
  await expect(chart).toBeVisible();
  expect(await chart.locator("path").first().getAttribute("d")).toMatch(
    /^M[^L]*M/,
  );
  await expect(
    page.getByText("Lowest 5-minute average: 55 bpm", { exact: false }),
  ).toBeVisible();
});
test("route navigation retains back, forward and active route state", async ({
  safePage: page,
  isMobile,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sleep", exact: true }).click();
  await expect(page).toHaveURL(/\/sleep/);
  await page.getByRole("link", { name: "Nutrition", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("link", { name: "Sleep", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Nutrition", exact: true }),
  ).toBeVisible();
  if (!isMobile) {
    await page.getByRole("link", { name: "Protocol home", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  }
});
