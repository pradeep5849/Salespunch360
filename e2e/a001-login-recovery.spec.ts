import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { expect, test } from "@playwright/test";

const db = new PrismaClient(),
  companyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  password = "Master-browser-fixture-934!",
  email = `${userId}@example.test`;
test.beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !url.pathname.endsWith("_ci")
  )
    throw new Error("Browser tests require isolated local *_ci database");
  await db.company.create({
    data: {
      id: companyId,
      name: "Master browser fixture",
      slug: `master-browser-${companyId}`,
      productEdition: "SALESPUNCH360_ACCOUNT",
      subscriptionStatus: "TRIAL",
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  await db.accountSettings.create({
    data: { companyId, enabledModules: ["INVENTORY"] },
  });
  await db.branch.create({
    data: {
      id: branchId,
      companyId,
      name: "Asset branch",
      code: "PRIMARY",
      isPrimary: true,
    },
  });
  await db.user.create({
    data: {
      id: userId,
      companyId,
      name: "Asset administrator",
      email,
      passwordHash: await hash(password),
      role: "ACCOUNT_USER",
      accountRole: "ACCOUNT_ADMIN",
      accountAccessActive: true,
      emailVerifiedAt: new Date(),
    },
  });
});
test.afterAll(async () => {
  await db.mobileSession.deleteMany({ where: { userId } });
  await db.customFieldValue.deleteMany({ where: { companyId } });
  await db.customFieldDefinition.deleteMany({ where: { companyId } });
  await db.customer.deleteMany({ where: { companyId } });
  await db.accountProduct.deleteMany({ where: { companyId } });
  await db.assetAssignmentHistory.deleteMany({ where: { companyId } });
  await db.asset.deleteMany({ where: { companyId } });
  await db.accountOperationalAudit.deleteMany({ where: { companyId } });
  await db.numberingSeries.deleteMany({ where: { companyId } });
  await db.accountSettings.deleteMany({ where: { companyId } });
  await db.user.deleteMany({ where: { companyId } });
  await db.branch.deleteMany({ where: { companyId } });
  await db.company.deleteMany({ where: { id: companyId } });
  await db.$disconnect();
});

test("login offline retry retains credentials and confirms session before another attempt", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  let intercepted = false;
  await page.route("**/sign-in", async (route) => {
    if (route.request().method() === "POST" && !intercepted) {
      intercepted = true;
      await route.abort("internetdisconnected");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Connection interrupted" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    password,
  );
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
});
test("lost login body revalidates the established cookie without another session rotation", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  let lost = false;
  await page.route("**/sign-in", async (route) => {
    if (route.request().method() === "POST" && !lost) {
      lost = true;
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: "invalid interrupted server-action response",
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Connection interrupted" }),
  ).toBeVisible();
  const version = (await db.user.findUniqueOrThrow({ where: { id: userId } }))
    .sessionVersion;
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: userId } })).sessionVersion,
  ).toBe(version);
});
