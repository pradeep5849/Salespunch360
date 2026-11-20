import { test, expect } from "@playwright/test";

test("public images load at responsive sizes and public/sign-in styles survive navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const hero = page.locator(".hero-reference-image");
  await expect(hero).toBeVisible();
  await expect
    .poll(() =>
      hero.evaluate((element) => {
        const image = element as HTMLImageElement;
        return image.complete && image.naturalWidth > 0;
      }),
    )
    .toBe(true);
  const width = page.viewportSize()!.width;
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width + 1);
  await expect(page.locator(".marketing")).toHaveCSS("display", "block");
  await expect(page.locator("body")).toHaveCSS("margin", "0px");
  // Follow a real link so this also exercises the CSS transition from public
  // routes to the independently styled authentication layout.
  await page
    .getByRole("link", { name: /login/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.locator(".login-page")).toHaveCSS("display", "flex");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  await page.goBack();
  await expect(hero).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width + 1);
});
