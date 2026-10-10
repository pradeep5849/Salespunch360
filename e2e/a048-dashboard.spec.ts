import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { expect, test } from "@playwright/test";

const fyId = randomUUID(),
  cashId = randomUUID(),
  incomeId = randomUUID();
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
    data: {
      companyId,
      enabledModules: ["INVENTORY", "EXPENSES", "SALES"],
      itemSettings: { enabled: true },
    },
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
  await db.financialYear.create({
    data: {
      id: fyId,
      companyId,
      name: "2026-27",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
    },
  });
  await db.ledgerAccount.createMany({
    data: [
      {
        id: cashId,
        companyId,
        code: "100",
        name: "Cash",
        accountClass: "ASSET",
        normalBalance: "DEBIT",
      },
      {
        id: incomeId,
        companyId,
        code: "400",
        name: "Income",
        accountClass: "INCOME",
        normalBalance: "CREDIT",
      },
    ],
  });
});
test.afterAll(async () => {
  await db.mobileSession.deleteMany({ where: { userId } });
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
    await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
    await tx.journalLine.deleteMany({ where: { companyId } });
    await tx.journalEntry.deleteMany({ where: { companyId } });
  });
  await db.accountingPeriodLock.deleteMany({ where: { companyId } });
  await db.ledgerAccount.deleteMany({ where: { companyId } });
  await db.financialYear.deleteMany({ where: { companyId } });
  await db.numberingSeries.deleteMany({ where: { companyId } });
  await db.accountOperationalAudit.deleteMany({ where: { companyId } });
  await db.accountSettings.deleteMany({ where: { companyId } });
  await db.user.deleteMany({ where: { companyId } });
  await db.branch.deleteMany({ where: { companyId } });
  await db.company.deleteMany({ where: { id: companyId } });
  await db.$disconnect();
});

test("dashboard drill-downs retain context and disable inaccessible destinations", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/workspace\/account/);
  await page.goto(`/workspace/account/dashboard?branchId=${branchId}`);
  const low = page.getByRole("link", { name: "Low Stock →", exact: true });
  await expect(low).toHaveAttribute(
    "href",
    new RegExp(`low-stock\\?branchId=${branchId}.*asOf=`),
  );
  await low.click();
  await expect(page).toHaveURL(/inventory\/low-stock/);
  await expect(
    page.getByText(/Warehouse positions with recorded movements/),
  ).toBeVisible();
  await page.goto(`/workspace/account/dashboard?branchId=${branchId}`);
  await page
    .getByRole("link", { name: "See all items →", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`inventory\\?branchId=${branchId}`));
  await page.goto(`/workspace/account/dashboard?branchId=${branchId}`);
  await page.getByRole("link", { name: "See Reports →", exact: true }).click();
  await expect(page).toHaveURL(/reports\?/);
  await expect(
    page.getByRole("link", { name: "profit loss", exact: true }),
  ).toHaveAttribute("href", new RegExp(`branchId=${branchId}.*from=`));
  await page.goto(`/workspace/account/dashboard?branchId=${branchId}`);
  await expect(
    page.getByRole("list", { name: "Exact monthly sales values" }),
  ).toContainText("₹0.00");
  await db.accountSettings.update({
    where: { companyId },
    data: { itemSettings: { enabled: false } },
  });
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Low Stock →", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "See all items →", exact: true }),
  ).toHaveCount(0);
  const login = await page.request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
    },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const denied = await page.request.get(
    `/api/v1/mobile/account/inventory/low-stock?branchId=${branchId}`,
    { headers: { authorization: `Bearer ${session.accessToken}` } },
  );
  expect(denied.status()).toBe(403);
  await page.goto(
    `/workspace/account/inventory/low-stock?branchId=${branchId}`,
  );
  await expect(
    page.getByRole("heading", { name: "Low Stock", exact: true }),
  ).toHaveCount(0);
});
