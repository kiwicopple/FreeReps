import { test, expect } from "./fixtures";
// Catch missing page chrome and collect synthetic theme reviews without live data.
test("Supabase synthetic visual review", async ({ safePage: page }, info) => {
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const route of [
      "/",
      "/nutrition",
      "/sleep",
      "/workouts",
      "/settings",
      "/chat",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      if (process.env.PW_SCREENSHOTS === "1")
        await page.screenshot({
          path: info.outputPath(
            `${scheme}-${route.replaceAll("/", "") || "today"}.png`,
          ),
          animations: "disabled",
        });
    }
  }
});
