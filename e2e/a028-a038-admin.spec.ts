import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";
test.setTimeout(120000);
const db = new PrismaClient(),
  userId = randomUUID(),
  companyId = randomUUID(),
  password = "Admin-browser-fixture-934!",
  email = `${userId}@example.test`,
  contentId = randomUUID(),
  priceId = randomUUID();
test.beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !url.pathname.endsWith("_ci")
  )
    throw new Error("Isolated local CI database required");
  await db.user.create({
    data: {
      id: userId,
      name: "Global fixture admin",
      email,
      passwordHash: await hash(password),
      role: "SUPER_ADMIN",
      emailVerifiedAt: new Date(),
    },
  });
});
test.afterAll(async () => {
  await db.publicTestimonial.deleteMany({ where: { id: contentId } });
  await db.billingPrice.deleteMany({ where: { id: priceId } });
  await db.billingOrder.deleteMany({ where: { companyId } });
  await db.billingAuditEvent.deleteMany({ where: { companyId } });
  await db.user.deleteMany({ where: { companyId } });
  await db.company.deleteMany({ where: { id: companyId } });
  await db.session.deleteMany({ where: { userId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});
test("admin empty and populated pages retain contrast and contained layouts at small widths", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const routes = [
    "/admin",
    "/admin/companies",
    "/admin/pricing",
    "/admin/testimonials",
    "/admin/blog",
    "/admin/video-tutorials",
    "/admin/public-site",
    "/admin/billing/orders",
    "/admin/billing/telecaller-orders",
  ];
  for (const route of routes) {
    await page.goto(route);
    const axe = await new AxeBuilder({ page })
      .withRules(["color-contrast"])
      .analyze();
    expect(axe.violations, route + " empty contrast").toEqual([]);
  }
  await db.company.create({
    data: {
      id: companyId,
      name: "LongCompany".repeat(12),
      slug: companyId,
      productEdition: "SALESPUNCH360_ACCOUNT",
    },
  });
  await db.user.create({
    data: {
      id: randomUUID(),
      companyId,
      name: "Company admin",
      email: `${companyId}@example.test`,
      passwordHash: "fixture",
      role: "ACCOUNT_USER",
      accountRole: "ACCOUNT_ADMIN",
    },
  });
  await db.publicTestimonial.create({
    data: {
      id: contentId,
      customerName: "LongCustomer".repeat(12),
      customerRole: "LongRole".repeat(24),
      quote: "LongQuote".repeat(180),
      isPublished: false,
    },
  });
  if (
    !(await db.billingPrice.findFirst({
      where: {
        role: "ACCOUNT_PACKAGE",
        period: "YEARLY",
        effectiveUntil: null,
      },
    }))
  )
    await db.billingPrice.create({
      data: {
        id: priceId,
        role: "ACCOUNT_PACKAGE",
        period: "YEARLY",
        amount: "999.50",
        currency: "INR",
      },
    });
  for (const width of [320, 360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/admin/companies",
      "/admin/pricing",
      "/admin/testimonials",
      `/admin/companies/${companyId}`,
    ]) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route +
          " width " +
          width +
          JSON.stringify(
            await page.evaluate(() =>
              Array.from(document.querySelectorAll("body *"))
                .filter((el) => {
                  const r = el.getBoundingClientRect();
                  return (
                    r.right > innerWidth &&
                    getComputedStyle(el.parentElement!).overflowX !== "auto"
                  );
                })
                .slice(0, 12)
                .map((el) => ({
                  tag: el.tagName,
                  class: el.className,
                  right: el.getBoundingClientRect().right,
                })),
            ),
          ),
      ).toBe(true);
      const axe = await new AxeBuilder({ page })
        .withRules(["color-contrast"])
        .analyze();
      expect(axe.violations, route + " contrast " + width).toEqual([]);
    }
  }
});
