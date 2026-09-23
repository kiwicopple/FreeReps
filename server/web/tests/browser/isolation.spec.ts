import { test, expect } from "@playwright/test";

// A request outside page interception (including teardown) must never be
// proxied to the personal backend by the browser test server.
test("test server blocks API requests outside browser fixtures", async ({
  request,
}) => {
  const response = await request.get("/api/v1/food/catalog");
  expect(response.status()).toBe(501);
  expect(await response.json()).toEqual({ error: "Unmocked test API request" });
});
