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
    data: { companyId, enabledModules: [] },
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
test("three-line journal validation is recoverable and history confirms the posted entry", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/accounting/new");
  await page.getByLabel("Date", { exact: true }).fill("2026-10-09");
  await page
    .getByLabel("Reference", { exact: true })
    .fill("Browser balanced journal");
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  const lines = page.locator("fieldset");
  await expect(lines).toHaveCount(3);
  await lines.nth(0).getByLabel("Ledger account").selectOption(cashId);
  await lines.nth(0).getByLabel("Debit", { exact: true }).fill("100");
  await lines.nth(1).getByLabel("Ledger account").selectOption(incomeId);
  await lines.nth(1).getByLabel("Credit", { exact: true }).fill("60");
  await lines.nth(2).getByLabel("Ledger account").selectOption(incomeId);
  await lines.nth(2).getByLabel("Credit", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Post balanced entry" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Total debits must equal total credits" }),
  ).toContainText("Total debits must equal total credits");
  await expect(lines.nth(0).getByLabel("Debit", { exact: true })).toHaveValue(
    "100",
  );
  await lines.nth(2).getByLabel("Credit", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Post balanced entry" }).click();
  await expect(page).toHaveURL(/accounting\/journals\?q=/);
  expect(
    await db.journalEntry.count({
      where: { companyId, reference: "Browser balanced journal" },
    }),
  ).toBe(1);
  await page.goto("/workspace/account/accounting/periods");
  await expect(page.getByLabel("Lock through date")).toHaveAttribute(
    "required",
    "",
  );
  await expect(
    page.getByRole("button", { name: "Save period lock" }),
  ).toBeVisible();
  await page.getByLabel("Lock through date").fill("2026-10-09");
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Close accounting period");
  await page.getByRole("button", { name: "Save period lock" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Accounting change saved",
  );
  for (const section of ["accounts", "cost-centres"]) {
    await page.goto("/workspace/account/accounting/" + section);
    await expect(page.getByLabel("Code", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  }
});
