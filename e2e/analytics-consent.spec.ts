import { expect, test, type Page } from "@playwright/test";
// Next may still be prefetching links when an assertion completes. Drain proxy handlers before closing the page.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});
const canonical = "https://www.salespunch360.com";
async function fixture(page: Page) {
  const scripts: string[] = [];
  const claims: string[] = [];
  await page.route("https://www.googletagmanager.com/**", async (route) => {
    scripts.push(route.request().url());
    await route.fulfill({
      contentType: "application/javascript",
      body: "window.__sp360GaStub = true;",
    });
  });
  // Serve the local production build under its canonical origin. No real Google requests.
  await page.route(canonical + "/**", async (route) => {
    const original = new URL(route.request().url());
    if (original.pathname === "/api/analytics/events") {
      claims.push(route.request().postData() ?? "");
      await route.fulfill({ status: 204 });
      return;
    }
    const response = await route.fetch({
      url: "http://127.0.0.1:3000" + original.pathname + original.search,
    });
    await route.fulfill({ response });
  });
  return { scripts, claims };
}
test("basic consent: no Google before consent; analytics-only does not grant advertising; navigation is sanitized and single-counted", async ({
  page,
}) => {
  const seen = await fixture(page);
  await page.goto(canonical + "/?email=private@example.invalid");
  await expect(
    page.getByRole("button", { name: "Analytics only", exact: true }),
  ).toBeVisible();
  expect(seen.scripts).toHaveLength(0);
  expect(seen.claims).toHaveLength(0);
  await page
    .getByRole("button", { name: "Analytics only", exact: true })
    .click();
  await expect.poll(() => seen.scripts.length).toBe(1);
  const commands = () =>
    page.evaluate(() =>
      ((window as unknown as { dataLayer: unknown[][] }).dataLayer ?? []).map(
        (command) => Array.from(command),
      ),
    );
  await expect
    .poll(
      async () =>
        (await commands()).filter(
          (command) => command[0] === "event" && command[1] === "page_view",
        ).length,
    )
    .toBe(1);
  const initial = await commands();
  expect(JSON.stringify(initial)).not.toContain("private@example.invalid");
  expect(
    initial.some(
      (command) =>
        command[0] === "consent" &&
        command[1] === "update" &&
        (command[2] as Record<string, string>).ad_storage === "denied",
    ),
  ).toBeTruthy();
  await page.evaluate(() =>
    window.history.pushState({}, "", "/privacy?phone=9999999999#private"),
  );
  await expect
    .poll(
      async () =>
        (await commands()).filter(
          (command) => command[0] === "event" && command[1] === "page_view",
        ).length,
    )
    .toBe(2);
  expect(JSON.stringify(await commands())).not.toContain("9999999999");
  await page
    .getByRole("button", { name: "Privacy choices", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await page.evaluate(() =>
    window.history.pushState(
      {},
      "",
      "/about?email=after-withdrawal@example.invalid",
    ),
  );
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (window as unknown as Record<string, unknown>)[
            "ga-disable-G-CNJNMM4XHV"
          ],
      ),
    )
    .toBe(true);
  expect(
    (await commands()).filter(
      (command) => command[0] === "event" && command[1] === "page_view",
    ),
  ).toHaveLength(2);
});
test("rejecting optional cookies persists without loading analytics", async ({
  page,
}) => {
  const seen = await fixture(page);
  await page.goto(canonical + "/");
  await page
    .getByRole("button", { name: "Reject optional", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Privacy choices", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Analytics only", exact: true }),
  ).toHaveCount(0);
  expect(seen.scripts).toHaveLength(0);
  expect(seen.claims).toHaveLength(0);
});
test("GPC prevents loading analytics and disables optional grant buttons", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "sp360_analytics_consent",
      value: "v1:1:1",
      domain: "www.salespunch360.com",
      path: "/",
      secure: true,
    },
  ]);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "globalPrivacyControl", {
      configurable: true,
      value: true,
    }),
  );
  const seen = await fixture(page);
  await page.goto(canonical + "/");
  await page
    .getByRole("button", { name: "Privacy choices", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Analytics only", exact: true }),
  ).toBeDisabled();
  expect(seen.scripts).toHaveLength(0);
  expect(seen.claims).toHaveLength(0);
});

test("production Android browser handoff uses production SDK mode and scoped CSP", async ({
  page,
}) => {
  await fixture(page);
  await page.route("https://sdk.cashfree.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.__paymentCalls=[];window.Cashfree=function(options){return {checkout:async function(input){window.__paymentCalls.push({mode:options.mode,session:input.paymentSessionId});}}};`,
    }),
  );
  const response = await page.goto(
    canonical + "/payment/checkout#session=synthetic-session",
  );
  await expect(
    page.getByRole("heading", { name: "SalesPunch360 payment", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sandbox only. No real money is charged."),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __paymentCalls?: unknown[] }).__paymentCalls,
      ),
    )
    .toEqual([{ mode: "production", session: "synthetic-session" }]);
  expect(response?.headers()["content-security-policy"]).toContain(
    "https://payments.cashfree.com",
  );
  expect(response?.headers()["content-security-policy"]).not.toContain(
    "https://sandbox.cashfree.com",
  );
});
test("invalid handoff cannot launch checkout", async ({ page }) => {
  await fixture(page);
  await page.route("https://sdk.cashfree.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.__paymentCalls=[];window.Cashfree=function(){return {checkout:async function(){window.__paymentCalls.push(true)}}};",
    }),
  );
  await page.goto(canonical + "/payment/checkout");
  await expect(page.getByRole("status")).toHaveText("Invalid payment session.");
  expect(
    await page.evaluate(
      () => (window as unknown as { __paymentCalls: unknown[] }).__paymentCalls,
    ),
  ).toHaveLength(0);
});
test("legacy sandbox handoff refuses production and return screen never claims success", async ({
  page,
}) => {
  const seen = await fixture(page);
  await page.goto(canonical + "/payment/sandbox#session=synthetic");
  await expect(
    page.getByRole("heading", { name: "Update SalesPunch360" }),
  ).toBeVisible();
  await page.goto(canonical + "/payment/complete?order=synthetic");
  await expect(
    page.getByText("Your payment attempt has ended.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Payment successful" }),
  ).toHaveCount(0);
  expect(seen.claims).toHaveLength(0);
});
