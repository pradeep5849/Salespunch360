import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
const db = new PrismaClient(),
  prefix = `public-fixture-${randomUUID()}`,
  play =
    "https://play.google.com/store/apps/details?id=com.salespunch360.mobile";
let previous: Awaited<ReturnType<typeof db.publicSiteSettings.findUnique>>;
test.beforeAll(async () => {
  const u = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(u.hostname) ||
    !u.pathname.endsWith("_ci")
  )
    throw new Error("Isolated CI database required");
  previous = await db.publicSiteSettings.findUnique({
    where: { id: "default" },
  });
  await db.publicSiteSettings.upsert({
    where: { id: "default" },
    create: { id: "default", googlePlayUrl: null },
    update: { googlePlayUrl: null },
  });
  await db.publicBlogPost.createMany({
    data: Array.from({ length: 26 }, (_, i) => ({
      slug: `${prefix}-${i}`,
      title: `Fixture article ${i}`,
      summary: "Useful test summary",
      content: i === 0 ? "long".repeat(150) : "Fixture content",
      isPublished: true,
      publishedAt: new Date(Date.now() - i * 1000),
    })),
  });
  await db.publicVideoTutorial.createMany({
    data: Array.from({ length: 26 }, (_, i) => ({
      title: `${prefix}-${i}`,
      description: "Fixture tutorial",
      videoUrl: "https://www.youtube.com/watch?v=fixture",
      isPublished: true,
      displayOrder: i,
    })),
  });
});
test.afterAll(async () => {
  await db.publicBlogPost.deleteMany({
    where: { slug: { startsWith: prefix } },
  });
  await db.publicVideoTutorial.deleteMany({
    where: { title: { startsWith: prefix } },
  });
  if (previous) {
    const { id, ...data } = previous;
    await db.publicSiteSettings.update({ where: { id }, data });
  } else await db.publicSiteSettings.deleteMany({ where: { id: "default" } });
  await db.$disconnect();
});
test("public download configuration navigation and empty social states are accessible", async ({
  page,
}) => {
  await page.goto("/android");
  await expect(
    page.getByRole("status").filter({ hasText: "Google Play download" }),
  ).toHaveCount(2);
  await expect(page.locator(".footer-app a.app-download")).toHaveCount(0);
  await expect(page.locator(".footer-socials")).toContainText(
    "Facebook link unavailable",
  );
  if ((page.viewportSize()?.width ?? 0) < 700) {
    const toggle = page.locator("button.menu-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  }
  const axe = await new AxeBuilder({ page })
    .include(".footer-socials")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await db.publicSiteSettings.update({
    where: { id: "default" },
    data: { googlePlayUrl: play },
  });
  await page.goto("/about");
  await expect(page.locator(".footer-app a.app-download")).toHaveAttribute(
    "href",
    play,
  );
  await expect(page.locator(".qr-preview")).toHaveAttribute("href", play);
  const response = await page.request.get("/android", { maxRedirects: 0 });
  expect([303, 307, 308]).toContain(response.status());
  expect(response.headers()["location"]).toBe(play);
  await db.publicSiteSettings.update({
    where: { id: "default" },
    data: { googlePlayUrl: null },
  });
});
test("content pages have one main landmark readable long text and bounded navigation", async ({
  page,
}) => {
  for (const route of [
    "/blog",
    "/careers",
    "/help",
    "/industries",
    "/user-guide",
    "/video-tutorials",
  ]) {
    await page.goto(route);
    await expect(page.locator("main")).toHaveCount(1);
  }
  await page.goto(`/blog/${prefix}-0`);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".blog-body")).toContainText("long".repeat(150));
  await page.goto("/blog");
  await expect(page.locator(".blog-grid article")).toHaveCount(24);
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("link", { name: "Previous page" })).toBeVisible();
  await page.goto("/video-tutorials");
  await expect(page.locator(".card-grid article")).toHaveCount(24);
  await expect(page.getByRole("link", { name: "Next page" })).toBeVisible();
  await page.goto("/compare");
  await page.getByRole("region", { name: /Product comparison/ }).focus();
  await expect(
    page.getByRole("region", { name: /Product comparison/ }),
  ).toBeFocused();
  await page.goto("/");
  await expect(page.locator(".proof-strip")).not.toContainText("50,000");
  await expect(page.locator(".proof-strip")).not.toContainText("95%");
  const accessibility = await new AxeBuilder({ page })
    .include(".reference-hero")
    .include(".reference-testimonials")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
