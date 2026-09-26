import { test, expect, routes } from "./fixtures";

// West of UTC, Singapore's next calendar day must not become the selected day.
for (const [zone, date] of [
  ["America/Los_Angeles", "2025-01-14"],
  ["America/New_York", "2025-01-14"],
  ["Asia/Singapore", "2025-01-15"],
]) {
  test.describe(zone, () => {
    test.use({ timezoneId: zone });
    test("today, sleep limits and daily requests follow the device", async ({
      safePage: page,
    }) => {
      const food = page.waitForRequest((r) => r.url().includes("/food?"));
      await page.goto("/nutrition");
      expect(new URL((await food).url()).searchParams.get("start")).toBe(date);
      await expect(
        page.getByRole("button", { name: "Choose end date" }),
      ).toHaveText(date);
      const dashboard = page.waitForRequest((r) =>
        r.url().includes("/metrics/latest?"),
      );
      await page.goto("/");
      expect(
        new URL((await dashboard).url()).searchParams.get("timezone"),
      ).toBe(zone);
      const sleep = page.waitForRequest((r) => r.url().includes("/sleep?"));
      await page.goto("/sleep");
      expect(new URL((await sleep).url()).searchParams.get("end")).toBe(date);
      await expect(
        page.getByRole("button", { name: "Choose night date" }),
      ).toHaveText("2025-01-14");
      // UTC-midnight record labels must not become the previous day in the US.
      if (!(await page.evaluate(() => window.innerWidth < 768))) {
        const history = page.getByTitle("14/01/2025 · 7.0 h", { exact: true });
        await expect(history).toBeVisible();
        await expect(history.locator(":scope > div")).not.toHaveCount(0);
        expect(
          await history.evaluate((el) => {
            const bounds = el.getBoundingClientRect();
            return [...el.children].every((child) => {
              const box = child.getBoundingClientRect();
              return (
                box.top >= bounds.top - 1 && box.bottom <= bounds.bottom + 1
              );
            });
          }),
        ).toBe(true);
      }

      const workouts = page.waitForRequest(
        (r) => new URL(r.url()).pathname === "/api/v1/workouts",
      );
      await page.goto("/workouts?range=1d");
      const query = new URL((await workouts).url()).searchParams;
      expect(query.get("start")).toBe(date);
      expect(query.get("end")).toBe(date);
      expect(query.get("timezone")).toBe(zone);
    });
  });
}

test.describe("travel while the app remains open", () => {
  test.use({ timezoneId: "America/Los_Angeles" });
  // A PWA can resume after a flight without reloading. Explicit historical selections stay put.
  test("refreshes Today on focus and retains recorded food dates and clocks", async ({
    safePage: page,
  }) => {
    await page.goto("/nutrition");
    await expect(
      page.getByRole("button", { name: "Choose end date" }),
    ).toHaveText("2025-01-14");
    const reload = page.waitForRequest(
      (r) =>
        new URL(r.url()).pathname === "/api/v1/food" &&
        new URL(r.url()).searchParams.get("start") === "2025-01-15",
    );
    await page.evaluate(() => {
      const original = Intl.DateTimeFormat;
      function formatter(
        ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
      ) {
        const value = new original(...args);
        const resolved = value.resolvedOptions.bind(value);
        value.resolvedOptions = () => ({
          ...resolved(),
          timeZone: "Asia/Singapore",
        });
        return value;
      }
      Object.setPrototypeOf(formatter, original);
      Object.defineProperty(Intl, "DateTimeFormat", {
        value: formatter,
        configurable: true,
      });
      window.dispatchEvent(new Event("focus"));
    });
    await reload;
    await expect(
      page.getByRole("button", { name: "Choose end date" }),
    ).toHaveText("2025-01-15");
    await page.route("**/api/v1/food?*", (r) => {
      const data = structuredClone(routes["/food"]) as {
        entries: { entry: { eaten_at: string; time_precision: string } }[];
      };
      data.entries[0].entry.eaten_at = "2025-01-15T08:00:00+08:00";
      data.entries[0].entry.time_precision = "exact";
      return r.fulfill({ json: data });
    });
    await page.goto("/nutrition?date=2025-01-15&tab=food-log");
    await expect(
      page.getByRole("button", { name: /^Breakfast/ }),
    ).toContainText("2025-01-15 · 08:00");
    await expect(
      page.getByRole("button", { name: "Choose end date" }),
    ).toHaveText("2025-01-15");
  });

  // 1d means this calendar date; changing UTC's date must not roll it forward early.
  test("rolls Today at local midnight without shifting an explicitly selected day", async ({
    safePage: page,
  }) => {
    await page.clock.setFixedTime(new Date("2025-03-10T06:59:00Z"));
    await page.goto("/nutrition");
    await expect(
      page.getByRole("button", { name: "Choose end date" }),
    ).toHaveText("2025-03-09");
    await page
      .getByRole("button", { name: "Previous day", exact: true })
      .click();
    await expect(page).toHaveURL(/date=2025-03-08/);
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page).not.toHaveURL(/date=/);
    await page.clock.setFixedTime(new Date("2025-03-10T07:01:00Z"));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("button", { name: "Choose end date" }),
    ).toHaveText("2025-03-10");
    await page.goto("/nutrition?date=2025-03-09&tab=protocol");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("button", { name: "Choose end date" }),
    ).toHaveText("2025-03-09");
    await expect(
      page.getByRole("tab", { name: "Protocol", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  });
});
