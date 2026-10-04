import { expect, test } from "@playwright/test";

test("health readiness is private and non-sensitive", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({
    status: "ready",
    database: "reachable",
  });
});

test("sign-in is responsive and password visibility is accessible", async ({
  page,
}, testInfo) => {
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { name: "Welcome Back!" }),
  ).toBeVisible();
  const password = page.locator("#password");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("sign-in.png"),
    fullPage: true,
  });
});

test("security headers restrict framing and retain geolocation", async ({
  request,
}) => {
  const response = await request.get("/sign-in");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(response.headers()["permissions-policy"]).toContain(
    "geolocation=(self)",
  );
});

test("production sign-in receives nonce scripts without permissive script execution", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_PRODUCTION !== "1",
    "Nonce enforcement is a production gate.",
  );
  const response = await page.goto("/sign-in");
  const scriptPolicy = response
    ?.headers()
    ["content-security-policy"].split(";")
    .find((value) => value.trim().startsWith("script-src"));
  expect(scriptPolicy).toContain("'nonce-");
  expect(scriptPolicy).not.toContain("unsafe-inline");
  expect(scriptPolicy).not.toContain("unsafe-eval");
  expect(await page.locator("script[nonce]").count()).toBeGreaterThan(0);
});
