import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("registration has sufficient contrast and associated recoverable validation", async ({
  page,
}) => {
  await page.goto("/register");
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page
    .locator("form.registration-form")
    .evaluate((form: HTMLFormElement) => (form.noValidate = true));
  await page.locator("[name=legalConsent]").check();
  await page.getByRole("button", { name: "Start my free trial" }).click();
  for (const field of [
    "companyName",
    "adminName",
    "adminEmail",
    "adminPassword",
    "confirmPassword",
  ]) {
    const control = page.locator("[name=" + field + "]");
    await expect(control).toHaveAttribute("aria-invalid", "true");
    await expect(control).toHaveAttribute("aria-describedby", field + "-error");
    await expect(page.locator("#" + field + "-error")).toBeVisible();
  }
  await expect(
    page.getByRole("radiogroup", { name: "Product edition" }),
  ).toHaveAttribute("aria-describedby", "productEdition-error");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.locator("[name=adminPassword]")).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Show confirmed password", exact: true })
    .click();
  await expect(page.locator("[name=confirmPassword]")).toHaveAttribute(
    "type",
    "text",
  );
});
