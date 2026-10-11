import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function connected(page: Page) {
  await page.route("**/api/v1/chat", (route) =>
    route.fulfill({ json: { configured: true, turns: [], has_more: false } }),
  );
}
const reply = (body: Record<string, unknown>) => ({
  ...body,
  sequence: 1,
  image_count: (body.images as string[]).length,
  reply: "Estimated synthetic lunch: 400 kcal.\n\nSaved to your nutrition log.",
  status: "complete",
  saved_entry_id: "synthetic-food",
  saved_date: "2025-01-13",
  created_at: "2025-01-15T04:00:00Z",
});

// Setup must never display or persist the private API key in browser storage.
test("chat connection and far-left navigation", async ({ safePage: page }) => {
  let key = "";
  await page.route("**/api/v1/chat/connection", async (route) => {
    expect(route.request().method()).toBe("PUT");
    key = route.request().postDataJSON().api_key;
    await route.fulfill({ json: { configured: true } });
  });
  await page.route("**/api/v1/chat", (route) =>
    route.fulfill({ json: { configured: !!key, turns: [], has_more: false } }),
  );
  await page.goto("/chat");
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link")
      .first(),
  ).toHaveText("Chat");
  await expect(page.getByLabel("Message", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("OpenAI API key", { exact: true })
    .fill("sk-synthetic-browser-test");
  await page.getByRole("button", { name: "Save connection" }).click();
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
  expect(key).toBe("sk-synthetic-browser-test");
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain("sk-synthetic");
  await page.getByRole("button", { name: "Connection", exact: true }).click();
  await expect(page.getByLabel("OpenAI API key", { exact: true })).toHaveValue(
    "",
  );
});

// Identical IDs and payloads on retry prevent duplicate writes after a dropped response.
test("retry retains message identity and saved historical date", async ({
  safePage: page,
}) => {
  const sent: Record<string, unknown>[] = [];
  let saved: ReturnType<typeof reply> | undefined;
  await page.route("**/api/v1/chat", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: {
          configured: true,
          turns: saved ? [saved] : [],
          has_more: false,
        },
      });
    const body = route.request().postDataJSON();
    sent.push(body);
    if (sent.length === 1)
      return route.fulfill({
        status: 503,
        json: { error: "Awaiting save confirmation. Retry this message." },
      });
    saved = reply(body);
    await route.fulfill({ json: saved });
  });
  await page.goto("/chat");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Log the synthetic lunch I ate yesterday");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Awaiting save confirmation",
  );
  await expect(page.getByLabel("Message", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Protocol reply" }),
  ).toContainText("400 kcal");
  expect(sent).toHaveLength(2);
  expect(sent[0]).toEqual(sent[1]);
  expect(sent[0]).toMatchObject({
    timezone: "Asia/Singapore",
    local_date: "2025-01-15",
  });
  await expect(
    page.getByRole("link", { name: "View nutrition log" }),
  ).toHaveAttribute(
    "href",
    "/nutrition?date=2025-01-13&range=day&tab=food-log",
  );
  await page.reload();
  await expect(
    page.getByRole("article", { name: "Protocol reply" }),
  ).toHaveCount(1);
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
});

// Camera/gallery images are re-encoded and can be removed; no photo bytes enter browser storage.
test("photo-only message, camera input, and attachment removal", async ({
  safePage: page,
}) => {
  await connected(page);
  let sent: Record<string, unknown> | undefined;
  await page.route("**/api/v1/chat", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    sent = route.request().postDataJSON();
    await route.fulfill({
      json: {
        ...reply(sent!),
        saved_entry_id: undefined,
        reply: "What did you eat from this menu?",
      },
    });
  });
  await page.goto("/chat");
  await expect(page.locator('input[capture="environment"]')).toHaveAttribute(
    "accept",
    "image/*",
  );
  // Generated pixels only, never a photograph of personal food.
  const pixels = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = 1200;
    canvas.getContext("2d")!.fillRect(0, 0, 2400, 1200);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const file = {
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: Buffer.from(pixels, "base64"),
  };
  await page.locator('input[type="file"][multiple]').setInputFiles(file);
  await expect(page.getByAltText("Attached photo 1")).toBeVisible();
  await page.getByRole("button", { name: "Remove photo 1" }).click();
  await expect(page.getByAltText("Attached photo 1")).toHaveCount(0);
  await page.locator('input[capture="environment"]').setInputFiles(file);
  await expect(page.getByAltText("Attached photo 1")).toBeVisible();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Protocol reply" }),
  ).toContainText("menu");
  expect(sent?.message).toBe("");
  const image = (sent?.images as string[])[0];
  expect(image).toMatch(/^data:image\/jpeg;base64,/);
  const dimensions = await page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  }, image);
  expect(dimensions).toEqual([1600, 800]);
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain("data:image");
  await expect(
    page.getByRole("link", { name: "View nutrition log" }),
  ).toHaveCount(0);
});

// Invalid estimates remain editable without losing the user's input or falsely reporting a save.
test("failed estimate retains draft and permits editing", async ({
  safePage: page,
}) => {
  await connected(page);
  await page.route("**/api/v1/chat", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 502,
          json: { error: "Nothing was logged; clarify the portion" },
        })
      : route.fallback(),
  );
  await page.goto("/chat");
  await page.getByLabel("Message", { exact: true }).fill("Synthetic meal");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Nothing was logged");
  await expect(
    page.getByRole("button", { name: /Edit message|Retry message/ }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Message", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    "Synthetic meal",
  );
  await page
    .getByLabel("Message", { exact: true })
    .fill("Synthetic meal, half a bowl");
});

// Local dates and timezone are sampled when sending, not hardcoded to the server's country.
test.describe("travel", () => {
  test.use({ timezoneId: "America/Los_Angeles" });
  test("sends the phone's local day", async ({ safePage: page }) => {
    await connected(page);
    let sent: Record<string, unknown> | undefined;
    await page.route("**/api/v1/chat", (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      sent = route.request().postDataJSON();
      return route.fulfill({ json: reply(sent!) });
    });
    await page.goto("/chat");
    await page.getByLabel("Message", { exact: true }).fill("Synthetic dinner");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      page.getByRole("article", { name: "Protocol reply" }),
    ).toBeVisible();
    expect(sent).toMatchObject({
      timezone: "America/Los_Angeles",
      local_date: "2025-01-14",
    });
  });
});

// Both themes and narrow devices must keep the composer, navigation, and long messages inside the viewport.
test("responsive chat, keyboard, and accessibility", async ({
  safePage: page,
}) => {
  await page.route("**/api/v1/chat", (route) =>
    route.fulfill({
      json: {
        configured: true,
        has_more: false,
        turns: [
          {
            ...reply({
              images: [],
              message: "Synthetic meal",
              local_date: "2025-01-15",
              id: "synthetic",
            }),
            reply: "Synthetic explanation ".repeat(60),
          },
        ],
      },
    }),
  );
  await page.goto("/chat");
  for (const width of [320, 390, 767, 768, 1024, 1279, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".app-main")).toHaveCSS(
      "margin-left",
      width < 768 ? "0px" : width < 1280 ? "64px" : "224px",
    );
    await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => localStorage.setItem("freereps.theme", value),
      theme,
    );
    await page.reload();
    await expect(
      page.getByRole("article", { name: "Protocol reply" }),
    ).toBeVisible();
    const violations = (await new AxeBuilder({ page }).analyze()).violations;
    expect(violations).toEqual([]);
  }
  await page.getByLabel("Message", { exact: true }).focus();
  await expect(page.getByLabel("Message", { exact: true })).toBeFocused();
  if (process.env.PW_SCREENSHOTS) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator(".app-main")).toHaveCSS(
        "margin-left",
        width < 768 ? "0px" : width < 1280 ? "64px" : "224px",
      );
      await page.screenshot({
        path: `test-results/chat-${test.info().project.name}-${width}.png`,
        fullPage: false,
      });
    }
  }
});

// The composer is a viewport footer, not a sticky element whose position depends on history length.
test("composer stays anchored with empty and long history", async ({
  safePage: page,
}) => {
  await connected(page);
  await page.goto("/chat");
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () => {
        const composer = await page.locator(".chat-composer").boundingBox();
        const nav =
          width < 768 ? await page.locator(".mobile-nav").boundingBox() : null;
        return Math.abs(
          composer!.y +
            composer!.height -
            ((nav?.y ?? 900) - (width < 768 ? 12 : 16)),
        );
      })
      .toBeLessThanOrEqual(2);
    const before = await page.locator(".chat-composer").boundingBox();
    await page.locator(".chat-history").evaluate((el) => {
      const p = document.createElement("p");
      p.textContent = "Synthetic history ".repeat(2000);
      el.appendChild(p);
    });
    await page.locator(".chat-scroll").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const after = await page.locator(".chat-composer").boundingBox();
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    ).toBe(true);
  }
  await expect(
    page.getByText("Messages, recent food logs and attached photos", {
      exact: false,
    }),
  ).toHaveCount(0);
});

// A reduced visual viewport represents the software keyboard; keep Send above it.
test("composer follows the keyboard viewport", async ({ safePage: page }) => {
  await connected(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/chat");
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, "height", {
      configurable: true,
      value: 500,
    });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator(".mobile-nav")).toBeHidden();
  await expect
    .poll(async () => {
      const composer = await page.locator(".chat-composer").boundingBox();
      return Math.abs(composer!.y + composer!.height - 488);
    })
    .toBeLessThanOrEqual(2);
  await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, "height");
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator(".mobile-nav")).toBeVisible();
});
