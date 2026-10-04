import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
test("sign-in has no serious accessibility violations and supports keyboard entry", async ({
  page,
}) => {
  await page.goto("/sign-in");
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    ),
  ).toEqual([]);
  await page.getByLabel("Email", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Show password" }),
  ).toBeFocused();
});
test("sign-in production navigation stays within release budget", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { name: "Welcome Back!" }),
  ).toBeVisible();
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    const scripts = performance
      .getEntriesByType("resource")
      .filter(
        (entry) =>
          (entry as PerformanceResourceTiming).initiatorType === "script",
      ) as PerformanceResourceTiming[];
    return {
      domReadyMs: navigation.domContentLoadedEventEnd,
      scriptBytes: scripts.reduce(
        (sum, entry) => sum + entry.decodedBodySize,
        0,
      ),
    };
  });
  expect(metrics.domReadyMs).toBeGreaterThan(0);
  expect(metrics.domReadyMs).toBeLessThan(10000);
  expect(metrics.scriptBytes).toBeGreaterThan(0);
  expect(metrics.scriptBytes).toBeLessThan(2000000);
});
