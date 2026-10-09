import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const db = new PrismaClient(),
  companyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  cashLedger = randomUUID(),
  expenseLedger = randomUUID(),
  incomeLedger = randomUUID(),
  moneyId = randomUUID(),
  expenseCategory = randomUUID(),
  incomeCategory = randomUUID(),
  password = "Expense-browser-173!",
  email = `${userId}@example.test`;
test.beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !url.pathname.endsWith("_ci")
  )
    throw new Error("Isolated local *_ci database required");
  await db.company.create({
    data: {
      id: companyId,
      name: "Expense browser fixture",
      slug: `expense-browser-${companyId}`,
      productEdition: "SALESPUNCH360_ACCOUNT",
      subscriptionStatus: "TRIAL",
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  await db.accountSettings.create({
    data: {
      companyId,
      enabledModules: [],
      expenseApprovalRequired: true,
      expenseApprovalThreshold: "0",
    },
  });
  await db.branch.create({
    data: {
      id: branchId,
      companyId,
      name: "Expense branch",
      code: "A",
      isPrimary: true,
    },
  });
  await db.user.create({
    data: {
      id: userId,
      companyId,
      name: "Expense administrator",
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
      companyId,
      name: "2026-27",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
    },
  });
  await db.ledgerAccount.createMany({
    data: [
      {
        id: cashLedger,
        companyId,
        code: "100",
        name: "Cash",
        accountClass: "ASSET",
        normalBalance: "DEBIT",
      },
      {
        id: expenseLedger,
        companyId,
        code: "500",
        name: "Operating expense",
        accountClass: "EXPENSE",
        normalBalance: "DEBIT",
      },
      {
        id: incomeLedger,
        companyId,
        code: "400",
        name: "Other income",
        accountClass: "INCOME",
        normalBalance: "CREDIT",
      },
    ],
  });
  await db.moneyAccount.create({
    data: {
      id: moneyId,
      companyId,
      branchId,
      type: "CASH",
      name: "Office cash",
      ledgerAccountId: cashLedger,
    },
  });
  await db.expenseCategory.createMany({
    data: [
      {
        id: expenseCategory,
        companyId,
        name: "Office expense",
        scope: "EXPENSE",
        defaultLedgerAccountId: expenseLedger,
      },
      {
        id: incomeCategory,
        companyId,
        name: "Other receipts",
        scope: "INCOME",
        defaultLedgerAccountId: incomeLedger,
      },
    ],
  });
});
test.afterAll(async () => {
  await db.mobileSession.deleteMany({ where: { userId } });
  await db.expenseAttachment.deleteMany({ where: { companyId } });
  await db.expenseTransaction.deleteMany({ where: { companyId } });
  await db.recurringExpenseTemplate.deleteMany({ where: { companyId } });
  await db.expenseCategory.deleteMany({ where: { companyId } });
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
    await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
    await tx.journalLine.deleteMany({ where: { companyId } });
    await tx.journalEntry.deleteMany({ where: { companyId } });
  });
  await db.moneyAccount.deleteMany({ where: { companyId } });
  await db.ledgerAccount.deleteMany({ where: { companyId } });
  await db.financialYear.deleteMany({ where: { companyId } });
  await db.accountOperationalAudit.deleteMany({ where: { companyId } });
  await db.numberingSeries.deleteMany({ where: { companyId } });
  await db.accountSettings.deleteMany({ where: { companyId } });
  await db.user.deleteMany({ where: { companyId } });
  await db.branch.deleteMany({ where: { companyId } });
  await db.company.deleteMany({ where: { id: companyId } });
  await db.$disconnect();
});
test("expense inline category, Save & New, draft edit, rejection reason and detail work at this viewport", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/expenses/new");
  await page
    .getByLabel("Transaction type", { exact: true })
    .selectOption("OTHER_INCOME");
  await expect(
    page
      .getByLabel("Category", { exact: true })
      .locator(`option[value="${expenseCategory}"]`),
  ).toHaveCount(0);
  await expect(
    page
      .getByLabel("Category", { exact: true })
      .locator(`option[value="${incomeCategory}"]`),
  ).toHaveCount(1);
  await expect(page.getByLabel("GST / tax", { exact: true })).toBeDisabled();
  await page
    .getByLabel("Transaction type", { exact: true })
    .selectOption("OFFICE_EXPENSE");
  await page
    .getByRole("button", { name: "Add billed item", exact: true })
    .click();
  await page
    .getByLabel("name item 1", { exact: true })
    .fill("Reference billed item");
  await page.getByLabel("quantity item 1", { exact: true }).fill("2");
  await page.getByLabel("rate item 1", { exact: true }).fill("50.25");
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Preserved inline notes");
  await page
    .getByRole("button", { name: "Add expense / income category", exact: true })
    .click();
  const inline = page.getByRole("region", { name: "Create category inline" });
  await inline
    .getByLabel("Category name", { exact: true })
    .fill("Inline office category");
  await inline
    .getByLabel("Posting ledger", { exact: true })
    .selectOption(expenseLedger);
  await inline
    .getByRole("button", { name: "Create category", exact: true })
    .click();
  await expect(inline).toHaveCount(0);
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "Preserved inline notes",
  );
  await expect(page.getByLabel("Category", { exact: true })).not.toHaveValue(
    "",
  );
  await page
    .getByLabel("Cash / bank account", { exact: true })
    .selectOption(moneyId);
  await page.getByLabel("Transaction date", { exact: true }).fill("2026-10-09");
  await page
    .getByLabel("Round total to nearest rupee", { exact: true })
    .check();
  await expect(page.getByRole("status")).toContainText("Total ₹101.00");
  const axe = await new AxeBuilder({ page })
    .include(".expense-entry")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.getByRole("button", { name: "Save & New", exact: true }).click();
  await expect(page).toHaveURL(/\/expenses\/new\?saved=/);
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue("");
  const row = await db.expenseTransaction.findFirstOrThrow({
    where: { companyId, notes: "Preserved inline notes" },
  });
  expect(row.totalAmount.toFixed(2)).toBe("101.00");
  expect(
    await db.expenseTransaction.count({
      where: { companyId, notes: "Preserved inline notes" },
    }),
  ).toBe(1);
  await page.goto(`/workspace/account/expenses/${row.id}`);
  const receipt = Buffer.from("%PDF-1.4\nBrowser expense receipt\n%%EOF");
  await page
    .getByLabel("Upload PDF or image (maximum 10 MB)", { exact: true })
    .setInputFiles({
      name: "receipt.pdf",
      mimeType: "application/pdf",
      buffer: receipt,
    });
  await page
    .getByRole("button", { name: "Upload attachment", exact: true })
    .click();
  const attachment = page.getByRole("link", {
    name: "Download receipt.pdf",
    exact: true,
  });
  await expect(attachment).toBeVisible();
  const download = await page.request.get(
    (await attachment.getAttribute("href"))!,
  );
  expect(download.status()).toBe(200);
  expect(await download.body()).toEqual(receipt);
  await page.getByRole("link", { name: "Edit draft", exact: true }).click();
  await page.getByLabel("Notes", { exact: true }).fill("Updated draft notes");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/expenses/${row.id}$`));
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reject", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Rejection reason", { exact: true })
    .fill("Receipt requires correction");
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(
    page.getByText(/EXPENSE REJECTED.*Receipt requires correction/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Edit draft", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("Other Income category eligibility, posting, reversal and direct tax validation are consistent", async ({
  request,
}) => {
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Income browser API",
    },
  });
  expect(login.status()).toBe(200);
  const { accessToken } = await login.json(),
    headers = { authorization: `Bearer ${accessToken}` };
  const input = {
    requestKey: randomUUID(),
    branchId,
    categoryId: incomeCategory,
    moneyAccountId: moneyId,
    type: "OTHER_INCOME",
    transactionDate: "2026-10-09",
    taxableAmount: "200",
    taxRate: "0",
    cessRate: "0",
  };
  const bad = await request.post("/api/v1/mobile/account/expenses", {
    headers,
    data: { ...input, cessRate: "1" },
  });
  expect(bad.status()).toBe(400);
  const saved = await request.post("/api/v1/mobile/account/expenses", {
    headers,
    data: input,
  });
  expect(saved.status()).toBe(201);
  const row = await saved.json();
  const retry = await request.post("/api/v1/mobile/account/expenses", {
    headers,
    data: input,
  });
  expect((await retry.json()).id).toBe(row.id);
  for (const status of ["PENDING_APPROVAL", "APPROVED"]) {
    expect(
      (
        await request.post(`/api/v1/mobile/account/expenses/${row.id}/action`, {
          headers,
          data: { action: "TRANSITION", status },
        })
      ).status(),
    ).toBe(200);
  }
  expect(
    (
      await request.post(`/api/v1/mobile/account/expenses/${row.id}/action`, {
        headers,
        data: { action: "POST" },
      })
    ).status(),
  ).toBe(200);
  const posted = await db.expenseTransaction.findUniqueOrThrow({
    where: { id: row.id },
  });
  const lines = await db.journalLine.findMany({
    where: { companyId, journalEntryId: posted.journalEntryId! },
  });
  expect(
    lines.find((l) => l.ledgerAccountId === incomeLedger)?.credit.toFixed(2),
  ).toBe("200.00");
  expect(
    (
      await request.post(`/api/v1/mobile/account/expenses/${row.id}/action`, {
        headers,
        data: {
          action: "REVERSE",
          entryDate: "2026-10-09",
          reason: "Browser reversal",
        },
      })
    ).status(),
  ).toBe(200);
  const detail = await request.get(
    `/api/v1/mobile/account/expenses/${row.id}`,
    { headers },
  );
  const d = await detail.json();
  expect(d.status).toBe("REVERSED");
  expect(d.category.name).toBe("Other receipts");
  expect(d.capabilities.edit).toBe(false);
});
