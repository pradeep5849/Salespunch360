import { extractPdfText } from "../tests/helpers/pdf-text";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  createCommercialDocumentForActor,
  postCommercialDocumentForActor,
  createSettlementForActor,
  documentOutstandingInTx,
  applyAdvanceForActor,
} from "@/lib/account/commercial";
import type { ProjectActor } from "@/lib/account/projects";
import { DEFAULT_LEDGER_ACCOUNTS } from "@/lib/accounting/default-accounts";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
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
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
    await tx.cheque.updateMany({
      where: { companyId },
      data: { settlementId: null },
    });
    await tx.advanceApplication.deleteMany({ where: { companyId } });
    await tx.openingBalanceAllocation.deleteMany({ where: { companyId } });
    await tx.settlementAllocation.deleteMany({ where: { companyId } });
    await tx.accountSettlement.deleteMany({ where: { companyId } });
    await tx.cheque.deleteMany({ where: { companyId } });
    await tx.commercialAuditEvent.deleteMany({ where: { companyId } });
    await tx.commercialDocumentLine.deleteMany({ where: { companyId } });
    await tx.commercialDocument.deleteMany({ where: { companyId } });
  });
  await db.ownerTransaction.deleteMany({ where: { companyId } });
  await db.ownerFinancialAccount.deleteMany({ where: { companyId } });
  await db.expenseItem.deleteMany({ where: { companyId } });
  await db.expenseAttachment.deleteMany({ where: { companyId } });
  await db.expenseTransaction.deleteMany({ where: { companyId } });
  await db.recurringExpenseTemplate.deleteMany({ where: { companyId } });
  await db.expenseCategory.deleteMany({ where: { companyId } });
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
    await tx.stockMovement.deleteMany({ where: { companyId } });
    await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
    await tx.journalLine.deleteMany({ where: { companyId } });
    await tx.journalEntry.deleteMany({ where: { companyId } });
  });
  await db.customFieldValue.deleteMany({ where: { companyId } });
  await db.customFieldDefinition.deleteMany({ where: { companyId } });
  await db.productPrice.deleteMany({ where: { companyId } });
  await db.accountProduct.deleteMany({ where: { companyId } });
  await db.accountService.deleteMany({ where: { companyId } });
  await db.accountCategory.deleteMany({ where: { companyId } });
  await db.accountUnit.deleteMany({ where: { companyId } });
  await db.warehouse.deleteMany({ where: { companyId } });
  await db.moneyAccount.deleteMany({ where: { companyId } });
  await db.ledgerAccount.deleteMany({ where: { companyId } });
  await db.financialYear.deleteMany({ where: { companyId } });
  await db.accountOperationalAudit.deleteMany({ where: { companyId } });
  await db.numberingSeries.deleteMany({ where: { companyId } });
  await db.accountSettings.deleteMany({ where: { companyId } });
  await db.project.deleteMany({ where: { companyId } });
  await db.customer.deleteMany({ where: { companyId } });
  await db.user.deleteMany({ where: { companyId } });
  await db.branch.deleteMany({ where: { companyId } });
  await db.company.deleteMany({ where: { id: companyId } });
  await db.$disconnect();
});
test("expense inline category, paid Save & New, review rejection and detail work at this viewport", async ({
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
  const itemDialog = page.getByRole("dialog", { name: "Add Expense Item" });
  await expect(itemDialog).toBeVisible();
  await expect(
    itemDialog.getByLabel("Item name *", { exact: true }),
  ).toBeFocused();
  await expect(
    itemDialog.getByRole("button", { name: "Save item", exact: true }),
  ).toBeDisabled();
  await itemDialog.getByLabel("Item name *", { exact: true }).fill("   ");
  await expect(
    itemDialog.getByRole("button", { name: "Save item", exact: true }),
  ).toBeDisabled();
  await itemDialog
    .getByLabel("Item name *", { exact: true })
    .fill("Cancelled local item");
  await itemDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(itemDialog).toHaveCount(0);
  await expect(page.getByLabel("name item 1", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add billed item", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Add billed item", exact: true })
    .click();
  await itemDialog
    .getByLabel("Item name *", { exact: true })
    .fill(" Reference billed item ");
  const itemAccessibility = await new AxeBuilder({ page })
    .include("dialog")
    .analyze();
  expect(
    itemAccessibility.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await itemDialog
    .getByRole("button", { name: "Save item", exact: true })
    .click();
  await expect(page.getByLabel("name item 1", { exact: true })).toHaveValue(
    "Reference billed item",
    { timeout: 15000 },
  );
  await page.getByLabel("quantity item 1", { exact: true }).fill("2");
  await page.getByLabel("rate item 1", { exact: true }).fill("50.25");
  await page
    .getByRole("button", { name: "Add billed item", exact: true })
    .click();
  await itemDialog
    .getByLabel("Item name *", { exact: true })
    .fill("Discarded second item");
  await itemDialog.getByLabel("Item name *", { exact: true }).press("Escape");
  await expect(itemDialog).toHaveCount(0);
  await expect(page.getByLabel("name item 2", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("quantity item 1", { exact: true })).toHaveValue(
    "2",
  );
  await expect(page.getByLabel("rate item 1", { exact: true })).toHaveValue(
    "50.25",
  );
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
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    attachment.click(),
  ]);
  const downloadedFile = await download.path();
  expect(downloadedFile).not.toBeNull();
  expect(await readFile(downloadedFile!)).toEqual(receipt);
  expect(row.status).toBe("POSTED");
  expect(row.approvalReviewStatus).toBe("PENDING");
  await expect(
    page.getByRole("link", { name: "Edit draft", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Submit", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Approval review", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Rejection reason", { exact: true })
    .fill("Receipt requires correction");
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(
    page.getByText(/EXPENSE REVIEW REJECTED.*Receipt requires correction/),
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
  page,
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
    taxableAmount: "9007199254740991.01",
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
  ).toBe("9007199254740991.01");
  const readSummary = async () => {
    const response = await request.get(
      `/api/v1/mobile/account/expenses?page=1&branchId=${branchId}&categoryId=${incomeCategory}`,
      { headers },
    );
    expect(response.status()).toBe(200);
    return (await response.json()).summary;
  };
  expect(await readSummary()).toMatchObject({
    expense: "0.00",
    income: "9007199254740991.01",
    period: "ALL_POSTED_HISTORY",
  });
  const categoryResponse = await request.get(
    "/api/v1/mobile/account/expense-categories?q=Other%20receipts",
    { headers },
  );
  expect(categoryResponse.status()).toBe(200);
  expect((await categoryResponse.json()).summary).toMatchObject({
    expense: "0.00",
    income: "9007199254740991.01",
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto(
    `/workspace/account/expenses?branchId=${branchId}&categoryId=${incomeCategory}`,
  );
  await expect(
    page.getByRole("region", { name: "Recognized expense and income totals" }),
  ).toContainText("9,00,71,99,25,47,40,991.01");
  await page.goto("/workspace/account/expenses/categories?q=Other%20receipts");
  await expect(
    page.getByRole("region", { name: "Category posted totals" }),
  ).toContainText("9,00,71,99,25,47,40,991.01");
  const accessibility = await new AxeBuilder({ page })
    .include(".employees-content")
    .analyze();
  expect(
    accessibility.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  // Reauthenticate the mobile client after signing into the web client.
  const refreshedLogin = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Income verification after web login",
    },
  });
  expect(refreshedLogin.status()).toBe(200);
  headers.authorization = `Bearer ${(await refreshedLogin.json()).accessToken}`;

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
  expect(await readSummary()).toMatchObject({
    expense: "0.00",
    income: "0.00",
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/expenses/categories?q=Other%20receipts");
  await expect(
    page.getByRole("region", { name: "Category posted totals" }),
  ).toContainText("0.00");
});

test("A053 recurring schedules retain inputs, reject premature bills and replay the requested occurrence", async ({
  page,
  request,
}) => {
  const { createRecurringTemplateForActor, generateRecurringExpenseForActor } =
    await import("../src/lib/account/expenses");
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } }),
    actor = {
      ...user,
      companyId,
      branchAccessScope: "ALL_BRANCHES" as const,
      branchIds: [],
    };
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/expenses/recurring");
  await page.getByText("Create recurring schedule", { exact: true }).click();
  const form = page.locator("form").filter({
    has: page.getByRole("button", { name: "Create schedule", exact: true }),
  });
  await expect(
    form
      .getByLabel("Expense category")
      .locator(`option[value="${incomeCategory}"]`),
  ).toHaveCount(0);
  await form.getByLabel("Expense category").selectOption(expenseCategory);
  await form.getByLabel("First due date").fill("2026-04-30");
  await form.getByLabel("Amount", { exact: true }).fill("31");
  const key = await form
    .locator('input[name="creationRequestKey"]')
    .inputValue();
  await form
    .getByRole("button", { name: "Create schedule", exact: true })
    .click();
  await expect
    .poll(() =>
      db.recurringExpenseTemplate.count({
        where: { companyId, creationRequestKey: key },
      }),
    )
    .toBe(1);
  const template = await db.recurringExpenseTemplate.findFirstOrThrow({
      where: { companyId, creationRequestKey: key },
    }),
    input = {
      branchId,
      categoryId: expenseCategory,
      frequency: "MONTHLY",
      nextDueDate: "2026-04-30",
      amount: "31",
      creationRequestKey: key,
    };
  expect((await createRecurringTemplateForActor(actor, input)).id).toBe(
    template.id,
  );
  await expect(
    createRecurringTemplateForActor(actor, { ...input, amount: "32" }),
  ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  await expect(
    createRecurringTemplateForActor(
      { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
      input,
    ),
  ).rejects.toThrow();
  await expect(
    generateRecurringExpenseForActor(actor, template.id, moneyId, "2027-12-31"),
  ).rejects.toThrow("RECURRING_NOT_DUE");
  const first = await generateRecurringExpenseForActor(
    actor,
    template.id,
    moneyId,
    "2026-04-30",
  );
  expect(first.status).toBe("PENDING_APPROVAL");
  expect(
    (
      await generateRecurringExpenseForActor(
        actor,
        template.id,
        moneyId,
        "2026-04-30",
      )
    ).id,
  ).toBe(first.id);
  expect(
    (
      await db.recurringExpenseTemplate.findUniqueOrThrow({
        where: { id: template.id },
      })
    ).nextDueDate
      .toISOString()
      .slice(0, 10),
  ).toBe("2026-05-30");
  expect(
    await db.expenseTransaction.count({
      where: { companyId, occurrenceKey: `${template.id}:2026-04-30` },
    }),
  ).toBe(1);
  const customer = await db.customer.create({
    data: { companyId, branchId, name: "Recurring project customer" },
  });
  const project = await db.project.create({
    data: {
      companyId,
      branchId,
      customerId: customer.id,
      createdById: userId,
      projectNumber: `REC-${randomUUID()}`,
      name: "Recurring module fixture",
    },
  });
  await db.recurringExpenseTemplate.update({
    where: { id: template.id },
    data: { projectId: project.id },
  });
  await expect(
    generateRecurringExpenseForActor(actor, template.id, moneyId, "2026-05-30"),
  ).rejects.toThrow("MODULE_DISABLED:PROJECTS");
  await db.recurringExpenseTemplate.update({
    where: { id: template.id },
    data: { projectId: null },
  });
  await page.reload();
  const card = page.getByRole("region", { name: `Schedule ${template.id}` });
  await card
    .getByRole("button", { name: "Pause schedule", exact: true })
    .click();
  await expect
    .poll(() =>
      db.recurringExpenseTemplate
        .findUnique({ where: { id: template.id } })
        .then((row) => row?.isActive),
    )
    .toBe(false);
  const axe = await new AxeBuilder({ page })
    .include(".employees-content")
    .analyze();
  expect(
    axe.violations.filter((row) =>
      ["critical", "serious"].includes(row.impact ?? ""),
    ),
  ).toEqual([]);
  expect(
    (await request.get("/api/v1/mobile/account/expenses/recurring")).status(),
  ).toBe(401);
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Recurring API regression",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  const list = await request.get("/api/v1/mobile/account/expenses/recurring", {
    headers,
  });
  expect(list.status()).toBe(200);
  expect(
    (await list.json()).some((row: { id: string }) => row.id === template.id),
  ).toBe(true);
  expect(
    (
      await request.patch(
        `/api/v1/mobile/account/expenses/recurring/${randomUUID()}`,
        { headers, data: { action: "ACTIVE", isActive: true } },
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.patch(
        `/api/v1/mobile/account/expenses/recurring/${template.id}`,
        { headers, data: { action: "ACTIVE", isActive: "true" } },
      )
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.patch(
        `/api/v1/mobile/account/expenses/recurring/${template.id}`,
        { headers, data: { action: "ACTIVE", isActive: true } },
      )
    ).status(),
  ).toBe(200);
  const generated = await request.patch(
    `/api/v1/mobile/account/expenses/recurring/${template.id}`,
    {
      headers,
      data: {
        action: "GENERATE",
        moneyAccountId: moneyId,
        expectedDueDate: "2026-05-30",
      },
    },
  );
  expect(generated.status()).toBe(200);
  const generatedId = (await generated.json()).id;
  const replay = await request.patch(
    `/api/v1/mobile/account/expenses/recurring/${template.id}`,
    {
      headers,
      data: {
        action: "GENERATE",
        moneyAccountId: moneyId,
        expectedDueDate: "2026-05-30",
      },
    },
  );
  expect(replay.status()).toBe(200);
  expect((await replay.json()).id).toBe(generatedId);
});

test("A055 active items sum every warehouse and support accessible bulk activation", async ({
  page,
  request,
}) => {
  const product = await db.accountProduct.create({
    data: {
      companyId,
      name: "Activation stock item",
      code: "ACT-1",
      trackInventory: true,
    },
  });
  const first = await db.warehouse.create({
    data: {
      companyId,
      branchId,
      name: "Activation first store",
      code: "ACT-A",
    },
  });
  const second = await db.warehouse.create({
    data: {
      companyId,
      branchId,
      name: "Activation second store",
      code: "ACT-B",
    },
  });
  await db.stockMovement.createMany({
    data: [first, second].map((store, i) => ({
      companyId,
      branchId,
      warehouseId: store.id,
      productId: product.id,
      movementType: "OPENING" as const,
      quantity: i ? 3 : 2,
      unitCost: 1,
      totalCost: i ? 3 : 2,
      sourceType: "OPENING_STOCK",
      sourceId: randomUUID(),
      movementDate: new Date("2026-10-09"),
      createdById: userId,
    })),
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/inventory/active");
  await expect(
    page.getByRole("link", { name: "Back to inventory" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search by name or code" })
    .fill("ACT-1");
  const row = page
    .locator(".active-items-list label")
    .filter({ hasText: "Activation stock item" });
  await expect(row.locator("b")).toHaveText("5.0");
  await row.getByRole("checkbox").check();
  const axe = await new AxeBuilder({ page })
    .include(".active-items-page")
    .analyze();
  expect(
    axe.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Mark as Inactive", exact: true })
    .click();
  await expect
    .poll(() =>
      db.accountProduct
        .findUnique({ where: { id: product.id } })
        .then((r) => r?.isActive),
    )
    .toBe(false);
  await expect(page).toHaveURL(/\/workspace\/account\/inventory$/);
  await page.goto("/workspace/account/inventory/active?mode=activate");
  await page
    .getByRole("textbox", { name: "Search by name or code" })
    .fill("ACT-1");
  await page
    .locator(".active-items-list label")
    .filter({ hasText: "Activation stock item" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("button", { name: "Mark as Active", exact: true })
    .click();
  await expect
    .poll(() =>
      db.accountProduct
        .findUnique({ where: { id: product.id } })
        .then((r) => r?.isActive),
    )
    .toBe(true);
  await expect(page).toHaveURL(/\/workspace\/account\/inventory$/);
  await db.accountProduct.createMany({
    data: Array.from({ length: 201 }, (_, i) => ({
      companyId,
      name: `Paging item ${String(i).padStart(3, "0")}`,
    })),
  });
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Activation API regression",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  const firstPage = await request.get(
    "/api/v1/mobile/account/master-data/items?q=Paging%20item&active=all&offset=0",
    { headers },
  );
  expect(firstPage.status()).toBe(200);
  expect((await firstPage.json()).length).toBe(200);
  const secondPage = await request.get(
    "/api/v1/mobile/account/master-data/items?q=Paging%20item&active=all&offset=200",
    { headers },
  );
  expect(secondPage.status()).toBe(200);
  expect((await secondPage.json()).length).toBe(1);
  const missing = await request.post("/api/v1/mobile/account/item-management", {
    headers,
    data: {
      action: "SET_ACTIVE",
      kind: "items",
      ids: [product.id, randomUUID()],
      isActive: false,
    },
  });
  expect(missing.status()).toBe(403);
  expect(
    (await db.accountProduct.findUniqueOrThrow({ where: { id: product.id } }))
      .isActive,
  ).toBe(true);
  const invalid = await request.post("/api/v1/mobile/account/item-management", {
    headers,
    data: {
      action: "SET_ACTIVE",
      kind: "items",
      ids: [product.id, "invalid"],
      isActive: false,
    },
  });
  expect(invalid.status()).toBe(400);
  const changed = await request.post("/api/v1/mobile/account/item-management", {
    headers,
    data: {
      action: "SET_ACTIVE",
      kind: "items",
      ids: [product.id],
      isActive: false,
    },
  });
  expect(changed.status()).toBe(200);
  expect((await changed.json()).count).toBe(1);
  await db.accountSettings.update({
    where: { companyId },
    data: { itemSettings: { enabled: false } },
  });
  expect(
    (
      await request.get("/api/v1/mobile/account/master-data/items?active=all", {
        headers,
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/v1/mobile/account/item-management", {
        headers,
        data: {
          action: "SET_ACTIVE",
          kind: "items",
          ids: [product.id],
          isActive: true,
        },
      })
    ).status(),
  ).toBe(400);
  await db.accountSettings.update({
    where: { companyId },
    data: { itemSettings: { enabled: true } },
  });
});

test("A054 inventory forms accept React metadata and expose accessible adjustment fields", async ({
  page,
}) => {
  const product = await db.accountProduct.create({
    data: {
      companyId,
      name: "Adjustment regression item",
      trackInventory: true,
    },
  });
  const warehouse = await db.warehouse.create({
    data: {
      companyId,
      branchId,
      name: "Adjustment regression store",
      code: `ADJ-${randomUUID().slice(0, 8)}`,
    },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/inventory/adjustments");
  await page
    .getByLabel("Warehouse", { exact: true })
    .selectOption(warehouse.id);
  await page.getByLabel("Product", { exact: true }).selectOption(product.id);
  await page.getByLabel("Adjustment direction").selectOption("IN");
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Unit cost", { exact: true }).fill("3");
  await page.getByLabel("Movement date").fill("2026-10-09");
  await page.getByLabel("Reason", { exact: true }).fill("Verified stock count");
  const axe = await new AxeBuilder({ page })
    .include(".employees-content")
    .analyze();
  expect(
    axe.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Save adjustments", exact: true })
    .click();
  await expect
    .poll(() =>
      db.stockMovement.count({
        where: {
          companyId,
          productId: product.id,
          movementType: "ADJUSTMENT_IN",
        },
      }),
    )
    .toBe(1);
  const row = await db.stockMovement.findFirstOrThrow({
    where: { companyId, productId: product.id, movementType: "ADJUSTMENT_IN" },
  });
  expect(row.quantity.toString()).toBe("2");
  expect(row.totalCost.toString()).toBe("6");
  expect(row.warehouseId).toBe(warehouse.id);
});

test("A056 categories retain duplicate errors and provide modal keyboard navigation", async ({
  page,
}) => {
  const category = await db.accountCategory.create({
    data: { companyId, name: `Category-${randomUUID()}` },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/inventory/categories");
  const sections = page.getByRole("navigation", { name: "Items sections" });
  await expect(
    sections.getByRole("link", { name: "Categories", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    sections.getByRole("link", { name: "Products", exact: true }),
  ).toHaveAttribute(
    "href",
    "/workspace/account/inventory/catalog?type=PRODUCT",
  );
  await expect(
    sections.getByRole("link", { name: "Services", exact: true }),
  ).toHaveAttribute(
    "href",
    "/workspace/account/inventory/catalog?type=SERVICE",
  );
  await expect(
    sections.getByRole("link", { name: "Units", exact: true }),
  ).toHaveAttribute("href", "/workspace/account/inventory/units");
  await page.getByLabel("Search categories").fill(category.name);
  await expect(
    page.locator(".manager-row").filter({ hasText: category.name }),
  ).toBeVisible();
  const trigger = page.getByRole("button", { name: "Add Category" });
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "Add Category" });
  const name = modal.getByLabel("Category name", { exact: true });
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("maxlength", "100");
  await name.fill(category.name);
  await modal.getByRole("button", { name: "Create", exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText("already exists");
  await expect(name).toHaveValue(category.name);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  expect(
    await modal.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .include(".category-create-dialog")
    .analyze();
  expect(
    axe.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  const unique = `New-${randomUUID()}`;
  await name.fill(unique);
  await modal.getByRole("button", { name: "Create", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect
    .poll(() =>
      db.accountCategory.count({ where: { companyId, name: unique } }),
    )
    .toBe(1);
  await page.getByLabel("Search categories").fill(unique);
  await expect(
    page.locator(".manager-row").filter({ hasText: unique }),
  ).toContainText("0");
  const pageAxe = await new AxeBuilder({ page })
    .include(".categories-page")
    .analyze();
  expect(
    pageAxe.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});

test("A057 no-op legacy settings save preserves effective defaults and conversion metadata", async ({
  page,
}) => {
  const legacy = {
    unitConversions: [
      { baseUnitId: randomUUID(), secondaryUnitId: randomUUID(), rate: "12" },
    ],
  };
  await db.accountSettings.update({
    where: { companyId },
    data: { itemSettings: legacy },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/inventory/item-settings");
  await expect(
    page.getByRole("checkbox", { name: /Barcode scanning for items/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /Calculate tax based on MRP/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /Update sale price from transaction/ }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Save Item Settings", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved");
  const saved = await db.accountSettings.findUniqueOrThrow({
    where: { companyId },
  });
  expect(saved.itemSettings).toMatchObject({
    ...legacy,
    barcodeScanning: false,
    taxOnMrp: false,
    updateSalePrice: false,
    itemUnits: true,
  });
  const event = await db.accountingAuditEvent.findFirstOrThrow({
    where: { companyId, eventType: "SETTINGS_CHANGED" },
    orderBy: { createdAt: "desc" },
  });
  expect(event.metadata).toMatchObject({
    sections: ["ITEMS"],
    before: legacy,
    after: { barcodeScanning: false, taxOnMrp: false, updateSalePrice: false },
  });
});

test("A052 expenses search older rows before pagination and respect selected branch", async ({
  page,
  request,
}) => {
  const paginationCategory = await db.expenseCategory.create({
    data: {
      companyId,
      name: `Pagination ${randomUUID()}`,
      scope: "EXPENSE",
      defaultLedgerAccountId: expenseLedger,
    },
  });
  const otherBranch = await db.branch.create({
    data: {
      companyId,
      name: "Other expense branch",
      code: `B-${randomUUID().slice(0, 6)}`,
    },
  });
  await db.expenseTransaction.createMany({
    data: Array.from({ length: 205 }, (_, i) => ({
      companyId,
      branchId,
      categoryId: paginationCategory.id,
      type: "OFFICE_EXPENSE",
      status: "DRAFT",
      transactionNumber: `PAGE-${String(i).padStart(3, "0")}`,
      transactionDate: new Date(i === 204 ? "2026-01-01" : "2026-10-01"),
      taxableAmount: "100",
      totalAmount: "100",
      createdById: userId,
      reference: i === 204 ? "old-search-target" : undefined,
    })),
  });
  await db.expenseTransaction.create({
    data: {
      companyId,
      branchId: otherBranch.id,
      categoryId: paginationCategory.id,
      type: "OFFICE_EXPENSE",
      status: "DRAFT",
      transactionNumber: "OTHER-BRANCH",
      transactionDate: new Date("2026-10-02"),
      taxableAmount: "100",
      totalAmount: "100",
      createdById: userId,
    },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.context().addCookies([
    {
      name: "sp360_account_branch",
      value: branchId,
      domain: "127.0.0.1",
      path: "/workspace/account",
    },
  ]);
  await page.goto(
    `/workspace/account/expenses?categoryId=${paginationCategory.id}`,
  );
  await expect(
    page.getByRole("navigation", { name: "Expense pagination" }),
  ).toContainText("of 205 transactions");
  await expect(
    page.getByRole("link", { name: "OTHER-BRANCH", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Expense pagination" }),
  ).toContainText("51–100");
  await page
    .getByRole("textbox", { name: "Search expenses" })
    .fill("old-search-target");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "PAGE-204", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Expense pagination" }),
  ).toContainText("of 1 transactions");
  const axe = await new AxeBuilder({ page })
    .include(".employees-content")
    .analyze();
  expect(
    axe.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.goto("/workspace/account/expenses?q=not-a-real-expense");
  await expect(page.getByRole("status")).toContainText("No expenses match");
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Expense pagination regression",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  const first = await request.get(
    `/api/v1/mobile/account/expenses?page=1&categoryId=${paginationCategory.id}&branchId=${branchId}`,
    { headers },
  );
  expect(first.status()).toBe(200);
  const firstData = await first.json();
  expect(firstData.rows.length).toBe(50);
  expect(firstData.total).toBe(205);
  expect(firstData.summary).toMatchObject({ expense: "0.00", income: "0.00" });
  expect(firstData.nextOffset).toBe(50);
  const terminal = await request.get(
    `/api/v1/mobile/account/expenses?page=1&categoryId=${paginationCategory.id}&branchId=${branchId}&offset=200`,
    { headers },
  );
  const last = await terminal.json();
  expect(last.rows.length).toBe(5);
  expect(last.nextOffset).toBeNull();
  const older = await request.get(
    `/api/v1/mobile/account/expenses?page=1&categoryId=${paginationCategory.id}&branchId=${branchId}&q=old-search-target&type=OFFICE_EXPENSE&status=DRAFT`,
    { headers },
  );
  const found = await older.json();
  expect(found.total).toBe(1);
  expect(found.rows[0].transactionNumber).toBe("PAGE-204");
  expect(
    (
      await request.get("/api/v1/mobile/account/expenses?page=1&status=WRONG", {
        headers,
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.get(
        `/api/v1/mobile/account/expenses?page=1&branchId=${randomUUID()}`,
        { headers },
      )
    ).status(),
  ).toBe(403);
});

test("A052 expected expense permission and module denial render a recoverable page", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  try {
    for (const accountRole of ["DATA_ENTRY", "PROJECT_MANAGER"] as const) {
      await db.user.update({ where: { id: userId }, data: { accountRole } });
      const response = await page.goto("/workspace/account/expenses");
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", {
          name: "Expenses access unavailable",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Back to Account", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Expenses", exact: true }),
      ).toHaveCount(0);
    }
  } finally {
    await db.user.update({
      where: { id: userId },
      data: { accountRole: "ACCOUNT_ADMIN" },
    });
  }
});

test("A060 item sheets contain keyboard focus and recover from share failures", async ({
  page,
}) => {
  await db.accountProduct.create({
    data: {
      companyId,
      name: "A060 share item",
      code: "A060-SHARE",
      salePrice: "12.50",
    },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/inventory");
  const filter = page.getByRole("button", {
    name: "Filter items",
    exact: true,
  });
  await filter.click();
  const sheet = page.getByRole("dialog", { name: "Filter By", exact: true });
  await expect(sheet).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await sheet.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(filter).toBeFocused();
  await filter.click();
  await sheet.getByLabel("Services", { exact: true }).check();
  await sheet.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("No items found", { exact: true })).toBeVisible();
  await filter.click();
  await sheet.getByRole("button", { name: "Clear", exact: true }).click();
  await sheet.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A060 share item", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    }),
  );
  await page
    .getByRole("button", { name: "Share A060 share item", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Unable to share item details",
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
    }),
  );
  await page
    .getByRole("button", { name: "Share A060 share item", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("1 items match");
  const more = page.getByRole("button", {
    name: "More item options",
    exact: true,
  });
  await more.click();
  const options = page.getByRole("dialog", {
    name: "More Options",
    exact: true,
  });
  await expect(options.getByRole("link", { name: "Categories" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).include("dialog[open]").analyze();
  expect(
    axe.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
});

test("A060 Show All opens scoped Products and Services catalogue with matching add controls", async ({
  page,
}) => {
  await db.accountProduct.create({
    data: { companyId, name: "A060 catalogue product" },
  });
  await db.accountService.create({
    data: { companyId, name: "A060 catalogue service", sellingRate: "25" },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto(
    `/workspace/account/inventory?branchId=${branchId}&asOf=2026-10-09`,
  );
  await page.getByRole("link", { name: "Show All", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/inventory/catalog\\?.*branchId=${branchId}.*type=PRODUCT`),
  );
  const tabs = page.getByRole("navigation", { name: "Items sections" });
  await expect(
    tabs.getByRole("link", { name: "Products", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "A060 catalogue product", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A060 catalogue service", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Add Product", exact: false }),
  ).toBeVisible();
  await tabs.getByRole("link", { name: "Services", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`branchId=${branchId}.*asOf=2026-10-09.*type=SERVICE`),
  );
  await expect(
    tabs.getByRole("link", { name: "Services", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "A060 catalogue product", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "A060 catalogue service", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Add Service", exact: false }).click();
  await expect(
    page.getByRole("button", { name: "Services", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("A058 Accountant can open Add Item without settings administration", async ({
  page,
}) => {
  await db.user.update({
    where: { id: userId },
    data: { accountRole: "ACCOUNTANT" },
  });
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/account/);
    const response = await page.goto("/workspace/account/inventory/items/new");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Add Item", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Item Name *", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Settings", exact: true }),
    ).toHaveCount(0);
  } finally {
    await db.user.update({
      where: { id: userId },
      data: { accountRole: "ACCOUNT_ADMIN" },
    });
  }
});

test("A058 item settings govern web controls and direct native creation without erasing historical fields", async ({
  page,
  request,
}) => {
  const unit = await db.accountUnit.create({
    data: { companyId, name: "Policy unit", symbol: "POL" },
  });
  await db.accountSettings.update({
    where: { companyId },
    data: {
      itemSettings: {
        enabled: true,
        itemType: "SERVICES",
        itemUnits: false,
        itemCategory: false,
        description: false,
        hsnSac: false,
        itemWiseTax: false,
        customFields: false,
        stockMaintenance: false,
      },
    },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/inventory/items/new");
  await expect(
    page.getByRole("button", { name: "Product", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Services", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Item Name *", { exact: true }).fill("Policy service");
  await expect(
    page.getByRole("button", { name: "Select Unit", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("HSN/SAC Code", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Tax Rate", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Stock", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect
    .poll(() =>
      db.accountService.count({ where: { companyId, name: "Policy service" } }),
    )
    .toBe(1);
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Item policy regression",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  for (const [kind, fields, code] of [
    ["items", {}, "PRODUCTS_DISABLED"],
    ["services", { unitId: unit.id }, "ITEM_UNITS_DISABLED"],
    ["services", { description: "blocked" }, "ITEM_DESCRIPTION_DISABLED"],
    ["services", { hsnSacCode: "1234" }, "ITEM_HSN_DISABLED"],
    ["services", { taxRate: "18" }, "ITEM_TAX_DISABLED"],
    [
      "services",
      { customFields: { key: "blocked" } },
      "ITEM_CUSTOM_FIELDS_DISABLED",
    ],
  ] as const) {
    const response = await request.post(
      `/api/v1/mobile/account/master-data/${kind}`,
      { headers, data: { name: "Blocked item", ...fields } },
    );
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe(code);
  }
  const options = await request.get(
    "/api/v1/mobile/account/master-data/services?view=options",
    { headers },
  );
  expect((await options.json()).itemSettings).toMatchObject({
    itemType: "SERVICES",
    itemWiseTax: false,
  });
  const historical = await db.accountService.create({
    data: {
      companyId,
      name: "Historical policy service",
      sacCode: "998314",
      sellingRate: "25",
    },
  });
  const definition = await db.customFieldDefinition.create({
    data: {
      companyId,
      entityType: "SERVICE",
      fieldKey: "historical",
      label: "Historical field",
      dataType: "TEXT",
      isActive: true,
    },
  });
  await db.customFieldValue.create({
    data: {
      companyId,
      entityType: "SERVICE",
      entityId: historical.id,
      definitionId: definition.id,
      value: "Preserve me",
    },
  });
  const edited = await request.patch(
    `/api/v1/mobile/account/master-data/services/${historical.id}`,
    { headers, data: { name: "Historical renamed", sellingRate: "25" } },
  );
  expect(edited.status()).toBe(200);
  expect(
    (
      await db.accountService.findUniqueOrThrow({
        where: { id: historical.id },
      })
    ).sacCode,
  ).toBe("998314");
  expect(
    (
      await db.customFieldValue.findFirstOrThrow({
        where: { companyId, entityId: historical.id },
      })
    ).value,
  ).toBe("Preserve me");
});

test("A060 stock display preserves exact decimal totals and configured rounding", async ({
  page,
}) => {
  const positive = await db.accountProduct.create({
    data: { companyId, name: "Exact quantity item", trackInventory: true },
  });
  const negative = await db.accountProduct.create({
    data: { companyId, name: "Negative fraction item", trackInventory: true },
  });
  const stores = await Promise.all(
    [0, 1].map((i) =>
      db.warehouse.create({
        data: {
          companyId,
          branchId,
          name: `Quantity store ${i}`,
          code: `Q-${i}`,
        },
      }),
    ),
  );
  await db.stockMovement.createMany({
    data: [
      {
        productId: positive.id,
        warehouseId: stores[0].id,
        movementType: "OPENING" as const,
        quantity: "0.1",
      },
      {
        productId: positive.id,
        warehouseId: stores[1].id,
        movementType: "OPENING" as const,
        quantity: "0.905",
      },
      {
        productId: negative.id,
        warehouseId: stores[0].id,
        movementType: "ADJUSTMENT_OUT" as const,
        quantity: "0.001",
      },
    ].map((row) => ({
      ...row,
      companyId,
      branchId,
      unitCost: 0,
      totalCost: 0,
      sourceType: "QUANTITY_REGRESSION",
      sourceId: randomUUID(),
      movementDate: new Date("2026-10-09"),
      createdById: userId,
    })),
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  for (const [decimals, positiveText, negativeText] of [
    [0, "1", "-0"],
    [1, "1.0", "-0.0"],
    [2, "1.01", "-0.00"],
    [3, "1.005", "-0.001"],
    [4, "1.0050", "-0.0010"],
  ] as const) {
    await db.accountSettings.update({
      where: { companyId },
      data: { itemSettings: { enabled: true, quantityDecimals: decimals } },
    });
    await page.goto(`/workspace/account/inventory?branchId=${branchId}`);
    for (const [name, value] of [
      ["Exact quantity item", positiveText],
      ["Negative fraction item", negativeText],
    ]) {
      const card = page
        .locator("article")
        .filter({ has: page.getByRole("heading", { name, exact: true }) });
      await expect(
        card.locator("dl div").filter({ hasText: "In Stock" }).locator("dd"),
      ).toHaveText(value);
    }
  }
});

test("A058 saved company HSN/SAC suggestions support manual entry and mobile options", async ({
  page,
  request,
}) => {
  await db.accountSettings.update({
    where: { companyId },
    data: { itemSettings: { enabled: true, hsnSac: true } },
  });
  await db.accountProduct.create({
    data: { companyId, name: "HSN suggestion product", hsnCode: "441231" },
  });
  await db.accountService.create({
    data: {
      companyId,
      name: "SAC suggestion service",
      sacCode: "998314",
      sellingRate: "25",
    },
  });
  await db.accountProduct.create({
    data: {
      companyId,
      name: "Inactive HSN product",
      hsnCode: "999999",
      isActive: false,
    },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/inventory/items/new");
  await page
    .getByLabel("Item Name *", { exact: true })
    .fill("Manual HSN product");
  await expect(page.locator("#saved-hsn-codes option")).toHaveCount(2);
  await expect(
    page.locator('#saved-hsn-codes option[value="441231"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('#saved-hsn-codes option[value="998314"]'),
  ).toHaveCount(1);
  await page.getByLabel("HSN/SAC Code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await db.accountProduct.findFirst({
            where: { companyId, name: "Manual HSN product" },
          })
        )?.hsnCode,
    )
    .toBe("123456");
  const response = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "HSN regression",
    },
  });
  expect(response.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await response.json()).accessToken}`,
  };
  const options = await request.get(
    "/api/v1/mobile/account/master-data/items?view=options",
    { headers },
  );
  expect(options.status()).toBe(200);
  expect((await options.json()).hsnCodes).toEqual([
    "123456",
    "441231",
    "998314",
  ]);
  await db.accountSettings.update({
    where: { companyId },
    data: { itemSettings: { enabled: true, hsnSac: false } },
  });
  const disabled = await request.get(
    "/api/v1/mobile/account/master-data/items?view=options",
    { headers },
  );
  expect((await disabled.json()).hsnCodes).toEqual([]);
});

test("A058 assigned item codes survive repeated clocks and concurrent duplicate saves", async ({
  page,
  request,
}) => {
  await db.accountSettings.update({
    where: { companyId },
    data: { itemSettings: { enabled: true } },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/inventory/items/new");
  await page
    .getByLabel("Item Name *", { exact: true })
    .fill("Assigned code product");
  await page.evaluate(() => {
    Date.now = () => 123456;
  });
  await page.getByRole("button", { name: "Assign Code", exact: true }).click();
  const field = page.getByPlaceholder("Item Code / Barcode", { exact: true });
  const first = await field.inputValue();
  expect(first).toMatch(/^ITEM-[A-F0-9-]{36}$/);
  await field.fill("");
  await page.getByRole("button", { name: "Assign Code", exact: true }).click();
  expect(await field.inputValue()).not.toBe(first);
  await field.fill("MANUAL-KEEP");
  await page.getByRole("button", { name: "Assign Code", exact: true }).click();
  await expect(field).toHaveValue("MANUAL-KEEP");
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Identifier regression",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  const data = { name: "Concurrent identifier product", code: first };
  const results = await Promise.all(
    [1, 2].map(() =>
      request.post("/api/v1/mobile/account/master-data/items", {
        headers,
        data,
      }),
    ),
  );
  expect(results.map((r) => r.status()).sort()).toEqual([201, 409]);
  const rejected = results.find((r) => r.status() === 409)!;
  expect(await rejected.json()).toMatchObject({
    error: "ITEM_IDENTIFIER_EXISTS",
    message: expect.stringContaining("already in use"),
  });
  expect(
    await db.accountProduct.count({ where: { companyId, code: first } }),
  ).toBe(1);
});

test("A057 Add Item quick settings persist single changes and enforce administration", async ({
  page,
  request,
}) => {
  await db.accountSettings.update({
    where: { companyId },
    data: {
      itemSettings: {
        enabled: true,
        quantityDecimals: 4,
        unitConversions: [{ baseUnitId: "kept", rate: "12" }],
      },
    },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/inventory/items/new");
  await page
    .getByLabel("Item Name *", { exact: true })
    .fill("Quick settings item");
  const trigger = page.getByRole("button", {
    name: "Item settings",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Item Settings",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  for (const [key, label] of [
    ["customFields", "Item Custom Fields"],
    ["additionalFields", "Additional Item Fields"],
    ["wholesalePrice", "Wholesale Price"],
    ["barcodeScanning", "Barcode Scan"],
    ["itemCategory", "Item Category"],
    ["description", "Description"],
  ]) {
    const checkbox = dialog.getByRole("checkbox", { name: label, exact: true });
    const next = !(await checkbox.isChecked());
    await checkbox.click();
    await expect
      .poll(
        async () =>
          (
            (
              await db.accountSettings.findUniqueOrThrow({
                where: { companyId },
              })
            ).itemSettings as Record<string, unknown>
          )[key],
      )
      .toBe(next);
    await expect(checkbox).toBeEnabled();
    await expect(checkbox).toBeChecked({ checked: next });
  }
  const saved = (
    await db.accountSettings.findUniqueOrThrow({ where: { companyId } })
  ).itemSettings as Record<string, unknown>;
  expect(saved.quantityDecimals).toBe(4);
  expect(saved.unitConversions).toEqual([{ baseUnitId: "kept", rate: "12" }]);
  expect(
    (
      await new AxeBuilder({ page })
        .include(".add-item-settings-dialog")
        .analyze()
    ).violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByLabel("Description", { exact: true })).toHaveCount(0);
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Quick settings regression",
    },
  });
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  const response = await request.post(
    "/api/v1/mobile/account/settings/item-settings-quick",
    { headers, data: { key: "description", value: true } },
  );
  expect(response.status()).toBe(200);
  expect((await response.json()).description).toBe(true);
  await db.user.update({
    where: { id: userId },
    data: { accountRole: "ACCOUNTANT" },
  });
  try {
    const denied = await request.post(
      "/api/v1/mobile/account/settings/item-settings-quick",
      { headers, data: { key: "description", value: false } },
    );
    expect(denied.status()).toBe(403);
    const options = await request.get(
      "/api/v1/mobile/account/master-data/items?view=options",
      { headers },
    );
    expect((await options.json()).canManageItemSettings).toBe(false);
    await page.context().clearCookies();
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/account/);
    await page.goto("/workspace/account/inventory/items/new");
    await page
      .getByRole("button", { name: "Item settings", exact: true })
      .click();
    for (const checkbox of await page
      .getByRole("dialog")
      .getByRole("checkbox")
      .all())
      await expect(checkbox).toBeDisabled();
  } finally {
    await db.user.update({
      where: { id: userId },
      data: { accountRole: "ACCOUNT_ADMIN" },
    });
  }
});

test("A065 independent owner identity and capital/profit entries work without user promotion", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/, { timeout: 20000 });
  await page.goto("/workspace/account/money/capital");
  await page
    .getByRole("button", { name: "Add owner / partner", exact: true })
    .click();
  const identity = page.locator(".owner-identity-form");
  await identity.getByLabel("Name", { exact: true }).fill("Browser partner");
  await identity.getByLabel("Type", { exact: true }).selectOption("PARTNER");
  await identity.getByLabel("Phone", { exact: true }).fill("9999999999");
  await identity
    .getByRole("button", { name: "Save owner / partner", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser partner", exact: true }),
  ).toBeVisible();
  const owner = await db.ownerFinancialAccount.findFirstOrThrow({
    where: { companyId, name: "Browser partner" },
  });
  expect(owner.userId).toBeNull();
  expect(owner.partyType).toBe("PARTNER");
  await page.getByRole("button", { name: "Add capital", exact: true }).click();
  const entry = page.locator(".owner-entry-form");
  await entry.getByLabel("Amount", { exact: true }).fill("100");
  await entry.getByLabel("Date", { exact: true }).fill("2026-10-09");
  await entry
    .getByRole("button", { name: "Post owner transaction", exact: true })
    .click();
  await expect
    .poll(() =>
      db.ownerTransaction.count({
        where: {
          companyId,
          ownerFinancialAccountId: owner.id,
          type: "INVESTMENT",
        },
      }),
    )
    .toBe(1);
  await page
    .getByRole("button", { name: "Draw from profit", exact: true })
    .click();
  await entry.getByLabel("Amount", { exact: true }).fill("101");
  await entry.getByLabel("Date", { exact: true }).fill("2026-10-09");
  await entry
    .getByRole("button", { name: "Post owner transaction", exact: true })
    .click();
  await expect(entry.getByRole("alert")).toContainText(/funds|balance/i);
  await expect(entry.getByLabel("Amount", { exact: true })).toHaveValue("101");
  await expect(entry.getByLabel("Date", { exact: true })).toHaveValue(
    "2026-10-09",
  );
  await entry.getByLabel("Amount", { exact: true }).fill("20");
  await entry
    .getByRole("button", { name: "Post owner transaction", exact: true })
    .click();
  await expect
    .poll(() =>
      db.ownerTransaction.count({
        where: {
          companyId,
          ownerFinancialAccountId: owner.id,
          type: "PROFIT_DISTRIBUTION",
        },
      }),
    )
    .toBe(1);
  await page
    .getByRole("button", { name: "Draw from capital", exact: true })
    .click();
  await entry.getByLabel("Amount", { exact: true }).fill("10");
  await entry.getByLabel("Date", { exact: true }).fill("2026-10-09");
  await entry
    .getByRole("button", { name: "Post owner transaction", exact: true })
    .click();
  await expect
    .poll(() =>
      db.ownerTransaction.count({
        where: {
          companyId,
          ownerFinancialAccountId: owner.id,
          type: "CAPITAL_WITHDRAWAL",
        },
      }),
    )
    .toBe(1);
  const sums = await db.journalLine.aggregate({
    where: {
      companyId,
      ledgerAccountId: owner.capitalLedgerId,
      journalEntry: { status: { in: ["POSTED", "REVERSED"] } },
    },
    _sum: { credit: true, debit: true },
  });
  expect(Number(sums._sum.credit) - Number(sums._sum.debit)).toBe(90);
  await expect(
    entry.locator("p").filter({ hasText: "Remaining posted capital:" }),
  ).toContainText("90.00");
  await page
    .getByRole("button", { name: "Edit Browser partner", exact: true })
    .click();
  await identity
    .getByLabel("Name", { exact: true })
    .fill("Renamed browser partner");
  await identity.getByLabel("Active", { exact: true }).uncheck();
  await identity
    .getByRole("button", { name: "Save owner / partner", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Renamed browser partner", exact: true }),
  ).toBeVisible();
  expect(
    await db.ownerTransaction.count({
      where: { companyId, ownerFinancialAccountId: owner.id },
    }),
  ).toBe(3);
  await page.goto(
    `/workspace/account/reports/owner-capital?ownerId=${owner.id}&from=2026-10-01&to=2026-10-12`,
  );
  const reportRow = page
    .getByRole("row")
    .filter({ hasText: "Renamed browser partner" });
  await expect(reportRow).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Combined total" }),
  ).toBeVisible();
  await expect(page.locator('select[name="ownerId"]')).toHaveValue(owner.id);
  const reportCells = await reportRow.locator("td").allTextContents();
  expect(reportCells[3]).toMatch(/90/);
  expect(reportCells[4]).toMatch(/20/);
  const exported = await page.request.get(
    `/api/account/reports/owner-capital/csv?ownerId=${owner.id}&from=2026-10-01&to=2026-10-12`,
  );
  expect(exported.status()).toBe(200);
  expect(await exported.text()).toContain("Combined total");
  await reportRow
    .getByRole("link", { name: "Renamed browser partner" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Renamed browser partner", exact: true }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(3);
  await page.getByLabel("From", { exact: true }).fill("2026-10-11");
  await page.getByLabel("To", { exact: true }).fill("2026-10-12");
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await expect(
    page.getByText("No transactions match these dates.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Clear dates", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(3);
  await page
    .getByRole("link", { name: "Back to Capital & Drawings", exact: true })
    .click();
  await expect(page).toHaveURL(/\/money\/capital(?:\?|$)/);
  const previousModules = await db.accountSettings.findUniqueOrThrow({
    where: { companyId },
    select: { enabledModules: true },
  });
  await db.accountSettings.update({
    where: { companyId },
    data: {
      enabledModules: [
        ...new Set([...previousModules.enabledModules, "ASSETS" as const]),
      ],
    },
  });
  await page.goto("/workspace/account/assets");
  const capitalSummary = page.getByRole("complementary", {
    name: "Owner capital",
  });
  await expect(capitalSummary).toContainText("90");
  await expect(capitalSummary).toContainText(
    "Book value across accessible branches",
  );
  await expect(
    capitalSummary.getByRole("heading", {
      name: "Posted company assets",
      exact: true,
    }),
  ).toBeVisible();
  await capitalSummary
    .getByRole("link", { name: "View Capital & Drawings" })
    .click();
  await expect(page).toHaveURL(/\/money\/capital(?:\?|$)/);
  await db.accountSettings.update({
    where: { companyId },
    data: { enabledModules: previousModules.enabledModules },
  });
  await page.goto("/workspace/account/assets");
  await expect(
    page.getByRole("complementary", { name: "Owner capital" }),
  ).toHaveCount(0);
  await page.goto(
    `/workspace/account/reports/owner-capital?ownerId=${owner.id}&from=2026-10-01&to=2026-10-12`,
  );
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Owner parity regression",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  const created = await request.post(
    "/api/v1/mobile/account/money/owner-setup",
    {
      headers,
      data: {
        name: "Mobile partner",
        partyType: "PARTNER",
        branchId,
        creationRequestKey: randomUUID(),
      },
    },
  );
  expect(created.status()).toBe(201);
  const body = await created.json();
  expect(body.name).toBe("Mobile partner");
  expect(body).not.toHaveProperty("creationInputHash");
  const context = await request.get("/api/v1/mobile/account/money", {
    headers,
  });
  expect(context.status()).toBe(200);
  const payload = await context.json();
  expect(JSON.stringify(payload)).not.toContain("passwordHash");
  expect(JSON.stringify(payload)).not.toContain("creationInputHash");
  const mobileHistory = await request.get(
    `/api/v1/mobile/account/money/owners/${owner.id}?from=2026-10-01&to=2026-10-12`,
    { headers },
  );
  expect(mobileHistory.status()).toBe(200);
  const historyBody = await mobileHistory.json();
  expect(historyBody.items).toHaveLength(3);
  expect(historyBody.owner.name).toBe("Renamed browser partner");
  expect(JSON.stringify(historyBody)).not.toContain("creationInputHash");
  const inaccessibleOwner = await request.get(
    `/api/v1/mobile/account/money/owners/${randomUUID()}`,
    { headers },
  );
  expect(inaccessibleOwner.status()).toBe(403);
  const badHistoryDate = await request.get(
    `/api/v1/mobile/account/money/owners/${owner.id}?from=2026-02-31`,
    { headers },
  );
  expect(badHistoryDate.status()).toBe(400);
  const mobileCapital = await request.get(
    "/api/v1/mobile/account/money/owner-summary",
    { headers },
  );
  expect(mobileCapital.status()).toBe(200);
  expect((await mobileCapital.json()).capital).toBe("90.00");
  const mobileReport = await request.get(
    `/api/v1/mobile/account/reports/owner-capital?ownerId=${owner.id}&from=2026-10-01&to=2026-10-12`,
    { headers },
  );
  expect(mobileReport.status()).toBe(200);
  expect((await mobileReport.json()).rows[0][0]).toBe(
    "Renamed browser partner",
  );
  expect(
    (
      await new AxeBuilder({ page }).include(".employees-content").analyze()
    ).violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});

test("A058 item save atomically records independent opening stock and native retry", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await db.accountSettings.update({
    where: { companyId },
    data: { itemSettings: { enabled: true, stockMaintenance: true } },
  });
  const warehouse = await db.warehouse.create({
    data: {
      companyId,
      branchId,
      name: "Item opening warehouse",
      code: `W-${randomUUID()}`,
    },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/inventory/items/new");
  await page
    .getByLabel("Item Name *", { exact: true })
    .fill("Web atomic opening");
  await page.getByPlaceholder("Purchase Price", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Stock", exact: true }).click();
  await page
    .getByLabel("Opening warehouse", { exact: true })
    .selectOption(warehouse.id);
  await page.getByRole("spinbutton", { name: /^Opening Stock/ }).fill("2.1250");
  await page.getByLabel("As of Date", { exact: true }).fill("2026-10-12");
  await page
    .getByRole("spinbutton", { name: /^At Price\/Unit/ })
    .fill("3.3333");
  await page.getByLabel("Item Location", { exact: true }).fill("Shelf A");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account\/inventory$/);
  const product = await db.accountProduct.findFirstOrThrow({
    where: { companyId, name: "Web atomic opening" },
  });
  expect(product.costPrice?.toString()).toBe("20");
  expect(product.itemLocation).toBe("Shelf A");
  const opening = await db.stockMovement.findFirstOrThrow({
    where: { companyId, productId: product.id },
  });
  expect(opening.quantity.toString()).toBe("2.125");
  expect(opening.unitCost.toString()).toBe("3.3333");
  expect(opening.totalCost.toString()).toBe("7.08");
  expect(opening.warehouseId).toBe(warehouse.id);
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Opening retry regression",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  const options = await request.get(
    "/api/v1/mobile/account/master-data/items?view=options",
    { headers },
  );
  expect(options.status()).toBe(200);
  expect(
    (await options.json()).warehouses.some(
      (row: { id: string }) => row.id === warehouse.id,
    ),
  ).toBe(true);
  const input = {
    name: "Native atomic opening",
    code: `M-${randomUUID()}`,
    sellingRate: "10",
    cost: "25",
    trackInventory: true,
    creationRequestKey: randomUUID(),
    itemLocation: "Shelf B",
    openingStock: {
      warehouseId: warehouse.id,
      quantity: "1.5",
      unitCost: "5",
      movementDate: "2026-10-12",
    },
  };
  const [first, second] = await Promise.all([
    request.post("/api/v1/mobile/account/master-data/items", {
      headers,
      data: input,
    }),
    request.post("/api/v1/mobile/account/master-data/items", {
      headers,
      data: input,
    }),
  ]);
  expect(first.status()).toBe(201);
  expect(second.status()).toBe(201);
  const firstBody = await first.json();
  expect((await second.json()).id).toBe(firstBody.id);
  expect(firstBody).not.toHaveProperty("creationRequestHash");
  expect(firstBody).not.toHaveProperty("creationRequestKey");
  expect(
    await db.stockMovement.count({
      where: { companyId, productId: firstBody.id },
    }),
  ).toBe(1);
  const stock = await request.get(
    `/api/v1/mobile/account/inventory/stock?branchId=${branchId}&asOf=2026-10-12`,
    { headers },
  );
  expect(stock.status()).toBe(200);
  const stockRows = await stock.json();
  const row = stockRows.find(
    (item: { productId: string }) => item.productId === firstBody.id,
  );
  expect(row.quantity).toBe("1.5");
  expect(row.stockValue).toBe("7.5");
  const denied = await request.post(
    "/api/v1/mobile/account/master-data/items",
    {
      headers,
      data: {
        ...input,
        name: "Denied opening",
        code: `X-${randomUUID()}`,
        creationRequestKey: randomUUID(),
        openingStock: { ...input.openingStock, warehouseId: randomUUID() },
      },
    },
  );
  expect(denied.status()).toBe(403);
  expect(
    await db.accountProduct.count({
      where: { companyId, name: "Denied opening" },
    }),
  ).toBe(0);
});

test("A057 price switches enforce web controls, direct API and assigned customer scope", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const product = await db.accountProduct.create({
    data: {
      companyId,
      name: "Price policy browser item",
      code: `P-${randomUUID()}`,
    },
  });
  const otherBranch = await db.branch.create({
    data: { companyId, name: "Other price branch", code: `B-${randomUUID()}` },
  });
  const customer = await db.customer.create({
      data: {
        companyId,
        branchId,
        name: "Allowed price customer",
        isAccountCustomer: true,
      },
    }),
    otherCustomer = await db.customer.create({
      data: {
        companyId,
        branchId: otherBranch.id,
        name: "Other branch price customer",
        isAccountCustomer: true,
      },
    });
  await db.accountSettings.update({
    where: { companyId },
    data: {
      itemSettings: {
        enabled: true,
        wholesalePrice: false,
        partyWiseRate: false,
      },
    },
  });
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Price policy regression",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  for (const [priceType, error] of [
    ["WHOLESALE", "WHOLESALE_PRICING_DISABLED"],
    ["CUSTOMER", "CUSTOMER_PRICING_DISABLED"],
  ]) {
    const response = await request.post(
      "/api/v1/mobile/account/inventory/prices",
      {
        headers,
        data: {
          productId: product.id,
          priceType,
          rate: "10",
          ...(priceType === "CUSTOMER" ? { customerId: customer.id } : {}),
        },
      },
    );
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe(error);
  }
  expect(
    await db.productPrice.count({
      where: { companyId, productId: product.id },
    }),
  ).toBe(0);
  await db.accountSettings.update({
    where: { companyId },
    data: {
      itemSettings: {
        enabled: true,
        wholesalePrice: true,
        partyWiseRate: true,
      },
    },
  });
  const wholesale = await request.post(
    "/api/v1/mobile/account/inventory/prices",
    {
      headers,
      data: { productId: product.id, priceType: "WHOLESALE", rate: "10.1250" },
    },
  );
  expect(wholesale.status()).toBe(201);
  expect((await wholesale.json()).rate).toBe("10.13");
  for (const target of [customer, otherCustomer]) {
    const response = await request.post(
      "/api/v1/mobile/account/inventory/prices",
      {
        headers,
        data: {
          productId: product.id,
          priceType: "CUSTOMER",
          customerId: target.id,
          rate: "9.25",
        },
      },
    );
    expect(response.status()).toBe(201);
  }
  await db.user.update({
    where: { id: userId },
    data: { branchAccessScope: "SELECTED_BRANCHES" },
  });
  await db.userBranchAccess.create({ data: { userId, branchId } });
  try {
    const forbidden = await request.post(
      "/api/v1/mobile/account/inventory/prices",
      {
        headers,
        data: {
          productId: product.id,
          priceType: "CUSTOMER",
          customerId: otherCustomer.id,
          rate: "8",
        },
      },
    );
    expect(forbidden.status()).toBe(403);
    const listed = await request.get(
      "/api/v1/mobile/account/inventory/prices",
      { headers },
    );
    expect(listed.status()).toBe(200);
    expect(
      (await listed.json()).some(
        (row: { customerId?: string }) => row.customerId === otherCustomer.id,
      ),
    ).toBe(false);
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/account/);
    await page.goto("/workspace/account/inventory/items");
    const form = page.getByRole("form", {
      name: "Price for Price policy browser item",
      exact: true,
    });
    await expect(form).toBeVisible();
    await form
      .getByLabel("Price type", { exact: true })
      .selectOption("CUSTOMER");
    await expect(form.getByLabel("Customer", { exact: true })).toBeVisible();
    expect(
      await form
        .getByLabel("Customer", { exact: true })
        .locator("option")
        .allTextContents(),
    ).not.toContain("Other branch price customer");
    await form
      .getByLabel("Price type", { exact: true })
      .selectOption("WHOLESALE");
    await expect(form.getByLabel("Customer", { exact: true })).toHaveCount(0);
    await form.getByLabel("Price rate", { exact: true }).fill("8.2");
    await form.getByLabel("Effective from", { exact: true }).fill("2026-10-12");
    await form.getByLabel("Effective to", { exact: true }).fill("2026-10-01");
    await form.getByRole("button", { name: "Add price", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText(/start date/i);
    await expect(form.getByLabel("Price rate", { exact: true })).toHaveValue(
      "8.2",
    );
    await form.getByLabel("Effective to", { exact: true }).fill("2026-10-20");
    await form.getByRole("button", { name: "Add price", exact: true }).click();
    await expect(form.getByRole("status")).toContainText("Price saved");
    expect(
      await db.productPrice.count({
        where: { companyId, productId: product.id },
      }),
    ).toBe(4);
    await db.accountSettings.update({
      where: { companyId },
      data: {
        itemSettings: {
          enabled: true,
          wholesalePrice: false,
          partyWiseRate: false,
        },
      },
    });
    await page.reload();
    await expect(
      form.getByLabel("Price type", { exact: true }).locator("option"),
    ).toHaveCount(1);
    await expect(form.getByLabel("Customer", { exact: true })).toHaveCount(0);
    expect(
      await db.productPrice.count({
        where: { companyId, productId: product.id },
      }),
    ).toBe(4);
    expect(
      (
        await new AxeBuilder({ page }).include(".employees-content").analyze()
      ).violations.filter((v) =>
        ["critical", "serious"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  } finally {
    await db.user.update({
      where: { id: userId },
      data: { branchAccessScope: "ALL_BRANCHES" },
    });
    await db.userBranchAccess.deleteMany({ where: { userId } });
    await db.accountSettings.update({
      where: { companyId },
      data: { itemSettings: { enabled: true } },
    });
  }
});

test("A066 cheque tabs, scoped search, date ordering and pagination preserve branch access", async ({
  page,
  request,
}) => {
  const chequeLedger = await db.ledgerAccount.create({
    data: {
      companyId,
      code: "CHEQUE_READ",
      name: "Cheque read bank ledger",
      accountClass: "ASSET",
      normalBalance: "DEBIT",
    },
  });
  const chequeBank = await db.moneyAccount.create({
    data: {
      companyId,
      branchId: null,
      type: "BANK",
      name: `Cheque bank ${randomUUID()}`,
      ledgerAccountId: chequeLedger.id,
    },
  });
  const other = await db.branch.create({
    data: {
      companyId,
      name: "Other cheque branch",
      code: `C-${randomUUID().slice(0, 6)}`,
    },
  });
  await db.cheque.createMany({
    data: [
      ...Array.from({ length: 25 }, (_, i) => ({
        companyId,
        branchId,
        moneyAccountId: chequeBank.id,
        chequeNumber: `READ-${String(i).padStart(3, "0")}`,
        partyName: `Received party ${i}`,
        chequeDate: new Date(i === 24 ? "2026-01-01" : "2026-10-01"),
        status: "RECEIVED" as const,
        reference: i === 24 ? "oldest-cheque-target" : undefined,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        companyId,
        branchId,
        moneyAccountId: chequeBank.id,
        chequeNumber: `ISSUE-${i}`,
        partyName: `Issued party ${i}`,
        chequeDate: new Date("2026-10-01"),
        status: "ISSUED" as const,
      })),
      ...Array.from({ length: 20 }, (_, i) => ({
        companyId,
        branchId,
        moneyAccountId: chequeBank.id,
        chequeNumber: `DEPOSIT-${i}`,
        partyName: `Closed party ${i}`,
        chequeDate: new Date("2026-10-01"),
        status: "DEPOSITED" as const,
      })),
      ...(["CLEARED", "CLEARED", "BOUNCED", "CANCELLED"] as const).map(
        (status, i) => ({
          companyId,
          branchId,
          moneyAccountId: chequeBank.id,
          chequeNumber: `TERMINAL-${i}`,
          partyName: "Historical cheque",
          chequeDate: new Date("2026-10-01"),
          status,
        }),
      ),
      {
        companyId,
        branchId: other.id,
        moneyAccountId: chequeBank.id,
        chequeNumber: "OTHER-CHEQUE-BRANCH",
        partyName: "Other branch party",
        chequeDate: new Date("2026-10-01"),
        status: "RECEIVED" as const,
      },
    ],
  });
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Cheque read checks",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  const read = async (query: string) => {
    const response = await request.get(
      `/api/v1/mobile/account/money/cheques?branchId=${branchId}&${query}`,
      { headers },
    );
    expect(response.status()).toBe(200);
    return response.json();
  };
  const first = await read("");
  expect(first.total).toBe(30);
  expect(first.rows).toHaveLength(25);
  expect(first.nextOffset).toBe(25);
  expect(
    first.rows.every((r: { branchId: string }) => r.branchId === branchId),
  ).toBe(true);
  const terminal = await read("offset=25");
  expect(terminal.rows).toHaveLength(5);
  expect(terminal.nextOffset).toBeNull();
  expect((await read("tab=CLOSED")).total).toBe(24);
  expect((await read("tab=ALL")).total).toBe(54);
  const oldest = await read("order=asc");
  expect(oldest.rows[0].chequeNumber).toBe("READ-024");
  const searched = await read("q=oldest-cheque-target");
  expect(searched.total).toBe(1);
  expect(searched.rows[0].moneyAccount.name).toBe(chequeBank.name);
  expect(
    (
      await request.get(
        `/api/v1/mobile/account/money/cheques?branchId=${randomUUID()}`,
        { headers },
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.get("/api/v1/mobile/account/money/cheques?tab=INVALID", {
        headers,
      })
    ).status(),
  ).toBe(400);
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/, { timeout: 15000 });
  await page.goto(`/workspace/account/money/cheques?branchId=${branchId}`);
  await expect(
    page.getByRole("navigation", { name: "Cheque pagination" }),
  ).toContainText("of 30 cheques");
  await expect(
    page.getByText("OTHER-CHEQUE-BRANCH", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Date order: newest first" }).click();
  await expect(page.getByRole("article").first()).toContainText("READ-024");
  await page
    .getByRole("navigation", { name: "Cheque status tabs" })
    .getByRole("link", { name: "Closed", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Cheque pagination" }),
  ).toContainText("of 24 cheques");
  await page
    .getByRole("navigation", { name: "Cheque status tabs" })
    .getByRole("link", { name: "All", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Cheque pagination" }),
  ).toContainText("of 54 cheques");
  await page
    .getByLabel("Search cheques", { exact: true })
    .fill("oldest-cheque-target");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Cheque pagination" }),
  ).toContainText("of 1 cheques");
  await page
    .locator("summary")
    .filter({ hasText: /^Record cheque$/ })
    .click();
  await expect(page.getByLabel("Cheque number", { exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .include(".employees-content")
    .analyze();
  expect(
    accessibility.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page
    .getByLabel("Search cheques", { exact: true })
    .fill("no-cheque-match");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "No cheques match this search",
  );
  await db.user.update({
    where: { id: userId },
    data: { branchAccessScope: "SELECTED_BRANCHES" },
  });
  await db.userBranchAccess.create({ data: { userId, branchId } });
  try {
    const scopedLogin = await request.post("/api/v1/mobile/auth/login", {
      data: {
        identifier: email,
        password,
        deviceId: randomUUID(),
        deviceName: "Assigned cheque branch",
      },
    });
    expect(scopedLogin.status()).toBe(200);
    const scopedHeaders = {
      authorization: `Bearer ${(await scopedLogin.json()).accessToken}`,
    };
    expect(
      (
        await request.get(
          `/api/v1/mobile/account/money/cheques?branchId=${other.id}`,
          { headers: scopedHeaders },
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.get("/api/v1/mobile/account/money/cheques?scope=all", {
          headers: scopedHeaders,
        })
      ).status(),
    ).toBe(403);
  } finally {
    await db.user.update({
      where: { id: userId },
      data: { branchAccessScope: "ALL_BRANCHES" },
    });
    await db.userBranchAccess.deleteMany({ where: { userId } });
  }
});

test("A052 new expense carries the explicitly selected branch without silently using the primary branch", async ({
  page,
}) => {
  const selected = await db.branch.create({
    data: {
      companyId,
      name: "Selected expense entry branch",
      code: `E-${randomUUID().slice(0, 6)}`,
    },
  });
  const scopedLedger = await db.ledgerAccount.create({
    data: {
      companyId,
      code: "EXPENSE_ENTRY_SCOPE",
      name: "Scoped expense entry ledger",
      accountClass: "ASSET",
      normalBalance: "DEBIT",
    },
  });
  const scopedAccount = await db.moneyAccount.create({
    data: {
      companyId,
      type: "BANK",
      name: "Scoped expense entry bank",
      ledgerAccountId: scopedLedger.id,
    },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/, { timeout: 15000 });
  await page.goto(`/workspace/account/expenses?branchId=${selected.id}`);
  await page
    .getByRole("link", { name: "New transaction", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/expenses/new\\?branchId=${selected.id}`),
  );
  await expect(page.getByLabel("Branch", { exact: true })).toHaveValue(
    selected.id,
  );
  await page
    .getByLabel("Category", { exact: true })
    .selectOption(expenseCategory);
  await page
    .getByLabel("Cash / bank account", { exact: true })
    .selectOption(scopedAccount.id);
  await page.getByLabel("Entered amount", { exact: true }).fill("10.25");
  await page.getByLabel("Transaction date", { exact: true }).fill("2026-10-09");
  await page.getByRole("button", { name: "Save & New", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/expenses/new\\?saved=.*&branchId=${selected.id}`),
  );
  await expect(page.getByLabel("Branch", { exact: true })).toHaveValue(
    selected.id,
  );
  await expect(page.getByLabel("Entered amount", { exact: true })).toHaveValue(
    "",
  );
  await page.goto(`/workspace/account/expenses/new?branchId=${randomUUID()}`);
  await expect(page.getByRole("status")).toContainText(
    "Expense entry unavailable",
  );
});

test("A052 paid save posts once under concurrent retries and review never posts payment again", async ({
  request,
}) => {
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Paid expense regression",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  const input = {
    requestKey: randomUUID(),
    recordAsPaid: true,
    branchId,
    categoryId: expenseCategory,
    moneyAccountId: moneyId,
    type: "OFFICE_EXPENSE",
    transactionDate: "2026-10-12",
    taxableAmount: "123.45",
    taxRate: "0",
    cessRate: "0",
  };
  const responses = await Promise.all(
    Array.from({ length: 4 }, () =>
      request.post("/api/v1/mobile/account/expenses", { headers, data: input }),
    ),
  );
  for (const response of responses) expect(response.status()).toBe(201);
  const rows = await Promise.all(responses.map((response) => response.json()));
  expect(new Set(rows.map((row) => row.id)).size).toBe(1);
  const expense = await db.expenseTransaction.findUniqueOrThrow({
    where: { id: rows[0].id },
  });
  expect(expense.status).toBe("POSTED");
  expect(expense.approvalReviewStatus).toBe("PENDING");
  expect(expense.paidDate?.toISOString().slice(0, 10)).toBe("2026-10-12");
  const lines = await db.journalLine.findMany({
    where: { journalEntryId: expense.journalEntryId! },
    orderBy: { id: "asc" },
  });
  expect(
    lines
      .find((line) => line.ledgerAccountId === cashLedger)
      ?.credit.toFixed(2),
  ).toBe("123.45");
  expect(
    lines
      .find((line) => line.ledgerAccountId === expenseLedger)
      ?.debit.toFixed(2),
  ).toBe("123.45");
  for (let i = 0; i < 2; i++) {
    const response = await request.post(
      `/api/v1/mobile/account/expenses/${expense.id}/action`,
      {
        headers,
        data: { action: "TRANSITION", status: "APPROVED" },
      },
    );
    expect(response.status()).toBe(200);
  }
  const reviewed = await db.expenseTransaction.findUniqueOrThrow({
    where: { id: expense.id },
  });
  expect(reviewed.status).toBe("POSTED");
  expect(reviewed.journalEntryId).toBe(expense.journalEntryId);
  expect(reviewed.approvalReviewStatus).toBe("APPROVED");
  expect(
    await db.journalLine.findMany({
      where: { journalEntryId: expense.journalEntryId! },
      orderBy: { id: "asc" },
    }),
  ).toEqual(lines);
  expect(
    await db.accountOperationalAudit.count({
      where: {
        companyId,
        entityId: expense.id,
        eventType: "EXPENSE_REVIEW_APPROVED",
      },
    }),
  ).toBe(1);
  const failedKey = randomUUID();
  const year = await db.financialYear.findFirstOrThrow({
    where: { companyId },
  });
  const lock = await db.accountingPeriodLock.create({
    data: {
      companyId,
      financialYearId: year.id,
      lockedThrough: new Date("2026-10-12"),
      updatedById: userId,
    },
  });
  try {
    const failed = await request.post("/api/v1/mobile/account/expenses", {
      headers,
      data: { ...input, requestKey: failedKey },
    });
    expect(failed.status()).toBe(400);
    expect((await failed.json()).error).toBe("PERIOD_LOCKED");
    expect(
      await db.expenseTransaction.count({
        where: { companyId, creationRequestKey: failedKey },
      }),
    ).toBe(0);
    // An already committed receipt remains replayable even after its accounting period closes.
    const replay = await request.post("/api/v1/mobile/account/expenses", {
      headers,
      data: input,
    });
    expect(replay.status()).toBe(201);
    expect((await replay.json()).id).toBe(expense.id);
  } finally {
    await db.accountingPeriodLock.delete({ where: { id: lock.id } });
  }
  const reversal = await request.post(
    `/api/v1/mobile/account/expenses/${expense.id}/action`,
    {
      headers,
      data: {
        action: "REVERSE",
        entryDate: "2026-10-12",
        reason: "Paid expense correction",
      },
    },
  );
  expect(reversal.status()).toBe(200);
  const corrected = await db.expenseTransaction.findUniqueOrThrow({
    where: { id: expense.id },
  });
  expect(corrected.status).toBe("REVERSED");
  const correctionLines = await db.journalLine.findMany({
    where: { journalEntryId: corrected.reversalJournalId! },
  });
  expect(
    correctionLines
      .find((line) => line.ledgerAccountId === cashLedger)
      ?.debit.toFixed(2),
  ).toBe("123.45");
  expect(
    correctionLines
      .find((line) => line.ledgerAccountId === expenseLedger)
      ?.credit.toFixed(2),
  ).toBe("123.45");
  for (const invalid of [
    { moneyAccountId: randomUUID() },
    { branchId: randomUUID() },
    { categoryId: randomUUID() },
  ]) {
    const requestKey = randomUUID();
    const denied = await request.post("/api/v1/mobile/account/expenses", {
      headers,
      data: { ...input, ...invalid, requestKey },
    });
    expect(denied.status()).toBe(400);
    expect(
      await db.expenseTransaction.count({
        where: { companyId, creationRequestKey: requestKey },
      }),
    ).toBe(0);
  }
  const pending = await request.post("/api/v1/mobile/account/expenses", {
    headers,
    data: { ...input, requestKey: randomUUID() },
  });
  expect(pending.status()).toBe(201);
  const pendingExpense = await pending.json();
  expect(
    (
      await request.post(
        `/api/v1/mobile/account/expenses/${pendingExpense.id}/action`,
        {
          headers,
          data: {
            action: "REVERSE",
            entryDate: "2026-10-12",
            reason: "Cancel pending review payment",
          },
        },
      )
    ).status(),
  ).toBe(200);
  expect(
    (
      await db.expenseTransaction.findUniqueOrThrow({
        where: { id: pendingExpense.id },
      })
    ).approvalReviewStatus,
  ).toBe("CANCELLED");
});

test("A052 expense catalogue reuses company items, stores validated photos and rejects cross-company reads", async ({
  request,
}) => {
  expect(
    (await request.get("/api/v1/mobile/account/expense-items")).status(),
  ).toBe(401);
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Expense catalogue regression",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  const requestKey = randomUUID();
  const name = `Reusable fuel ${randomUUID()}`;
  const image = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const input = {
    name,
    requestKey,
    photo: { name: "fuel.png", mimeType: "image/png", buffer: image },
  };
  const saved = await request.post("/api/v1/mobile/account/expense-items", {
    headers,
    multipart: input,
  });
  expect(saved.status()).toBe(201);
  const item = await saved.json();
  expect(item.hasPhoto).toBe(true);
  expect(item).not.toHaveProperty("photoObjectKey");
  const retry = await request.post("/api/v1/mobile/account/expense-items", {
    headers,
    multipart: input,
  });
  expect(retry.status()).toBe(201);
  expect((await retry.json()).id).toBe(item.id);
  const changed = await request.post("/api/v1/mobile/account/expense-items", {
    headers,
    multipart: { ...input, name: `${name} altered` },
  });
  expect(changed.status()).toBe(409);
  const listed = await request.get(
    `/api/v1/mobile/account/expense-items?q=${encodeURIComponent(name)}`,
    { headers },
  );
  expect(
    (await listed.json()).rows.map((row: { id: string }) => row.id),
  ).toEqual([item.id]);
  const photo = await request.get(
    `/api/v1/mobile/account/expense-items/${item.id}/photo`,
    { headers },
  );
  expect(photo.status()).toBe(200);
  expect(photo.headers()["content-type"]).toBe("image/webp");
  const foreignCompany = await db.company.create({
    data: {
      name: "Catalogue tenant isolation",
      slug: `catalogue-${randomUUID()}`,
    },
  });
  let foreignId: string | undefined;
  try {
    const foreign = await db.expenseItem.create({
      data: {
        companyId: foreignCompany.id,
        name,
        normalizedName: name.toLowerCase(),
        creationRequestKey: randomUUID(),
        creationRequestHash: "0".repeat(64),
        photoObjectKey: "unreachable-foreign-photo",
      },
    });
    foreignId = foreign.id;
    expect(
      (
        await request.get(
          `/api/v1/mobile/account/expense-items/${foreign.id}/photo`,
          { headers },
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await (
          await request.get(
            `/api/v1/mobile/account/expense-items?q=${encodeURIComponent(name)}`,
            { headers },
          )
        ).json()
      ).total,
    ).toBe(1);
  } finally {
    if (foreignId) await db.expenseItem.delete({ where: { id: foreignId } });
    await db.company.delete({ where: { id: foreignCompany.id } });
  }
});

test("A053 late recurring payment preserves due date and posts once on actual payment date", async ({
  request,
}) => {
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Recurring paid regression",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  const schedule = await db.recurringExpenseTemplate.create({
    data: {
      companyId,
      branchId,
      categoryId: expenseCategory,
      frequency: "MONTHLY",
      nextDueDate: new Date("2026-09-01"),
      anchorDate: new Date("2026-09-01"),
      amount: "80.25",
      createdById: userId,
    },
  });
  const generated = await request.patch(
    `/api/v1/mobile/account/expenses/recurring/${schedule.id}`,
    {
      headers,
      data: {
        action: "GENERATE",
        moneyAccountId: moneyId,
        expectedDueDate: "2026-09-01",
      },
    },
  );
  expect(generated.status()).toBe(200);
  const bill = await generated.json();
  expect(bill.journalEntryId).toBeNull();
  const payload = {
    action: "PAY_RECURRING",
    requestKey: randomUUID(),
    moneyAccountId: moneyId,
    paymentDate: "2026-10-12",
  };
  const responses = await Promise.all(
    Array.from({ length: 4 }, () =>
      request.post(`/api/v1/mobile/account/expenses/${bill.id}/action`, {
        headers,
        data: payload,
      }),
    ),
  );
  for (const response of responses) expect(response.status()).toBe(200);
  const paid = await db.expenseTransaction.findUniqueOrThrow({
    where: { id: bill.id },
  });
  expect(paid.transactionDate.toISOString().slice(0, 10)).toBe("2026-09-01");
  expect(paid.paidDate?.toISOString().slice(0, 10)).toBe("2026-10-12");
  expect(paid.status).toBe("POSTED");
  expect(paid.approvalReviewStatus).toBe("PENDING");
  const journal = await db.journalEntry.findUniqueOrThrow({
    where: { id: paid.journalEntryId! },
    include: { lines: true },
  });
  expect(journal.entryDate.toISOString().slice(0, 10)).toBe("2026-10-12");
  expect(
    journal.lines
      .find((line) => line.ledgerAccountId === cashLedger)
      ?.credit.toFixed(2),
  ).toBe("80.25");
  expect(
    await db.accountOperationalAudit.count({
      where: {
        companyId,
        entityId: bill.id,
        eventType: "RECURRING_EXPENSE_PAID",
      },
    }),
  ).toBe(1);
  const changed = await request.post(
    `/api/v1/mobile/account/expenses/${bill.id}/action`,
    { headers, data: { ...payload, paymentDate: "2026-10-13" } },
  );
  expect(changed.status()).toBe(409);
  const filtered = await request.get(
    `/api/v1/mobile/account/expenses?page=1&templateId=${schedule.id}&limit=1`,
    { headers },
  );
  expect(filtered.status()).toBe(200);
  const matching = await filtered.json();
  expect(matching.total).toBe(1);
  expect(matching.rows[0].id).toBe(bill.id);
  expect(matching.summary.expense).toBe("80.25");
});

test("A052 accountant may record payment but cannot approve or reverse it; Data Entry remains denied", async ({
  request,
}) => {
  const otherUser = await db.user.create({
    data: {
      companyId,
      name: "Expense role fixture",
      email: `${randomUUID()}@example.test`,
      passwordHash: await hash(password),
      role: "ACCOUNT_USER",
      accountRole: "ACCOUNTANT",
      accountAccessActive: true,
      emailVerifiedAt: new Date(),
    },
  });
  try {
    const login = await request.post("/api/v1/mobile/auth/login", {
      data: {
        identifier: otherUser.email,
        password,
        deviceId: randomUUID(),
        deviceName: "Expense accountant role",
      },
    });
    expect(login.status()).toBe(200);
    const headers = {
      authorization: `Bearer ${(await login.json()).accessToken}`,
    };
    const created = await request.post("/api/v1/mobile/account/expenses", {
      headers,
      data: {
        requestKey: randomUUID(),
        recordAsPaid: true,
        branchId,
        categoryId: expenseCategory,
        moneyAccountId: moneyId,
        type: "OFFICE_EXPENSE",
        transactionDate: "2026-10-12",
        taxableAmount: "25.00",
      },
    });
    expect(created.status()).toBe(201);
    const expense = await created.json();
    expect(expense.status).toBe("POSTED");
    expect(
      (
        await request.post(
          `/api/v1/mobile/account/expenses/${expense.id}/action`,
          { headers, data: { action: "TRANSITION", status: "APPROVED" } },
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post(
          `/api/v1/mobile/account/expenses/${expense.id}/action`,
          {
            headers,
            data: {
              action: "REVERSE",
              entryDate: "2026-10-12",
              reason: "Forbidden reversal",
            },
          },
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await db.expenseTransaction.findUniqueOrThrow({
          where: { id: expense.id },
        })
      ).approvalReviewStatus,
    ).toBe("PENDING");
    await db.user.update({
      where: { id: otherUser.id },
      data: { accountRole: "DATA_ENTRY" },
    });
    const deniedLogin = await request.post("/api/v1/mobile/auth/login", {
      data: {
        identifier: otherUser.email,
        password,
        deviceId: randomUUID(),
        deviceName: "Expense Data Entry denial",
      },
    });
    expect(deniedLogin.status()).toBe(200);
    const deniedHeaders = {
      authorization: `Bearer ${(await deniedLogin.json()).accessToken}`,
    };
    expect(
      (
        await request.get("/api/v1/mobile/account/expenses", {
          headers: deniedHeaders,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post("/api/v1/mobile/account/expenses", {
          headers: deniedHeaders,
          data: {},
        })
      ).status(),
    ).toBe(403);
  } finally {
    await db.mobileSession.deleteMany({ where: { userId: otherUser.id } });
  }
});

test("A053 schedule editing rejects stale changes and preserves original creation retry identity", async ({
  request,
}) => {
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Recurring edit regression",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  const input = {
    branchId,
    categoryId: expenseCategory,
    frequency: "MONTHLY",
    creationRequestKey: randomUUID(),
    nextDueDate: "2026-11-01",
    amount: "100.00",
  };
  const created = await request.post(
    "/api/v1/mobile/account/expenses/recurring",
    { headers, data: input },
  );
  expect(created.status()).toBe(201);
  const schedule = await created.json();
  const before = await db.expenseTransaction.count({ where: { companyId } });
  const payload = {
    action: "EDIT",
    frequency: "QUARTERLY",
    amount: "120.00",
    nextDueDate: "2026-11-15",
    expectedUpdatedAt: schedule.updatedAt,
  };
  const changed = await request.patch(
    `/api/v1/mobile/account/expenses/recurring/${schedule.id}`,
    { headers, data: payload },
  );
  expect(changed.status()).toBe(200);
  const edited = await changed.json();
  expect(edited.frequency).toBe("QUARTERLY");
  expect(edited.amount).toBe("120");
  expect(edited.anchorDate.slice(0, 10)).toBe("2026-11-15");
  expect(
    (
      await request.patch(
        `/api/v1/mobile/account/expenses/recurring/${schedule.id}`,
        { headers, data: payload },
      )
    ).status(),
  ).toBe(409);
  const replay = await request.post(
    "/api/v1/mobile/account/expenses/recurring",
    { headers, data: input },
  );
  expect(replay.status()).toBe(201);
  expect((await replay.json()).id).toBe(schedule.id);
  expect(await db.expenseTransaction.count({ where: { companyId } })).toBe(
    before,
  );
});

test("A053 web payment control posts a late bill while retaining its original due date", async ({
  page,
  request,
}) => {
  const bill = await db.expenseTransaction.create({
    data: {
      companyId,
      branchId,
      categoryId: expenseCategory,
      type: "OFFICE_EXPENSE",
      status: "DRAFT",
      transactionNumber: `UI-${randomUUID()}`,
      transactionDate: new Date("2026-09-05"),
      taxableAmount: "42.10",
      taxRate: "0",
      taxAmount: "0",
      totalAmount: "42.10",
      moneyAccountId: moneyId,
      occurrenceKey: `${randomUUID()}:2026-09-05`,
      createdById: userId,
    },
  });
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Recurring due-date guard",
    },
  });
  expect(login.status()).toBe(200);
  const guard = await request.patch(
    `/api/v1/mobile/account/expenses/${bill.id}`,
    {
      headers: { authorization: `Bearer ${(await login.json()).accessToken}` },
      data: {
        branchId,
        categoryId: expenseCategory,
        type: "OFFICE_EXPENSE",
        moneyAccountId: moneyId,
        transactionDate: "2026-09-06",
        taxableAmount: "42.10",
      },
    },
  );
  expect(guard.status()).toBe(400);
  expect((await guard.json()).error).toBe("RECURRING_DUE_DATE_IMMUTABLE");
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/, { timeout: 15000 });
  await page.goto(`/workspace/account/expenses/${bill.id}`);
  await page.getByLabel("Payment date", { exact: true }).fill("2026-10-12");
  await page.getByLabel("Paid from", { exact: true }).selectOption(moneyId);
  await page
    .getByRole("button", { name: "Mark recurring bill paid", exact: true })
    .click();
  await expect(page.getByText("Approval review", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByRole("button", { name: "Mark recurring bill paid", exact: true }),
  ).toHaveCount(0, { timeout: 15000 });
  const paid = await db.expenseTransaction.findUniqueOrThrow({
    where: { id: bill.id },
  });
  expect(paid.status).toBe("POSTED");
  expect(paid.transactionDate.toISOString().slice(0, 10)).toBe("2026-09-05");
  expect(paid.paidDate?.toISOString().slice(0, 10)).toBe("2026-10-12");
  const accessibility = await new AxeBuilder({ page })
    .include(".employees-content")
    .analyze();
  expect(
    accessibility.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});

test("cheque entry and confirmed cash closure/reopening work at this viewport", async ({
  page,
}) => {
  await db.ledgerAccount.createMany({
    data: DEFAULT_LEDGER_ACCOUNTS.map((row) => ({ ...row, companyId })),
    skipDuplicates: true,
  });
  const bankLedger = await db.ledgerAccount.findFirstOrThrow({
    where: { companyId, systemKey: "BANK" },
  });
  const bank = await db.moneyAccount.create({
    data: {
      companyId,
      branchId,
      type: "BANK",
      name: "Cheque test bank",
      ledgerAccountId: bankLedger.id,
    },
  });
  const party = await db.customer.create({
    data: {
      companyId,
      branchId,
      name: "Cheque test customer",
      isAccountCustomer: true,
    },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/money/cheques");
  await page.getByText("Record cheque", { exact: true }).first().click();
  await page.getByLabel("Bank account", { exact: true }).selectOption(bank.id);
  const number = randomUUID().slice(0, 8);
  await page.getByLabel("Cheque number", { exact: true }).fill(number);
  await page.getByLabel("Cheque date", { exact: true }).fill("2026-10-10");
  await page.getByLabel("Search party", { exact: true }).fill(party.name);
  await page.getByRole("button", { name: "Find parties", exact: true }).click();
  await expect(
    page
      .getByLabel("Party", { exact: true })
      .locator("option", { hasText: party.name }),
  ).toBeAttached({ timeout: 15000 });
  await page.getByLabel("Party", { exact: true }).selectOption(party.id);
  await page.getByLabel("Amount", { exact: true }).fill("1593.00");
  await page
    .getByRole("button", { name: "Record cheque", exact: true })
    .click();
  const card = page.getByRole("article", { name: `Cheque ${number}` });
  await expect(card).toBeVisible({ timeout: 15000 });
  const recorded = await db.cheque.findFirstOrThrow({
    where: { companyId, chequeNumber: number },
  });
  expect(
    (
      await db.accountSettlement.findUniqueOrThrow({
        where: { id: recorded.settlementId! },
      })
    ).status,
  ).toBe("PENDING_CHEQUE");
  await card.getByLabel("Action date", { exact: true }).fill("2026-10-12");
  await card
    .getByLabel("Description", { exact: true })
    .fill("Cash closure reference");
  await card
    .getByLabel("Payment account", { exact: true })
    .selectOption(moneyId);
  await card
    .getByRole("button", { name: "Confirm cheque action", exact: true })
    .click();
  await expect(card).not.toBeAttached({ timeout: 15000 });
  await page.getByRole("link", { name: "Closed", exact: true }).click();
  await expect(card).toContainText("CLEARED");
  await expect(card).toContainText("Cash closure reference");
  await card
    .getByLabel("Cheque action", { exact: true })
    .selectOption("REOPEN");
  await card.getByLabel("Action date", { exact: true }).fill("2026-10-13");
  await card.getByLabel("Reason", { exact: true }).fill("Undo closure");
  await card
    .getByRole("button", { name: "Confirm cheque action", exact: true })
    .click();
  await expect(card).not.toBeAttached({ timeout: 15000 });
  await page.getByRole("link", { name: "Open", exact: true }).click();
  await expect(card).toContainText("RECEIVED");
  expect(
    (
      await db.accountSettlement.findUniqueOrThrow({
        where: { id: recorded.settlementId! },
      })
    ).status,
  ).toBe("REVERSED");
  const axe = await new AxeBuilder({ page }).include("article").analyze();
  expect(axe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("legacy cheque source completion saves explicit details without posting at this viewport", async ({
  page,
}) => {
  await db.ledgerAccount.createMany({
    data: DEFAULT_LEDGER_ACCOUNTS.map((row) => ({ ...row, companyId })),
    skipDuplicates: true,
  });
  const ledger = await db.ledgerAccount.findFirstOrThrow({
    where: { companyId, systemKey: "BANK" },
  });
  const bank =
    (await db.moneyAccount.findFirst({
      where: { companyId, ledgerAccountId: ledger.id, type: "BANK" },
    })) ??
    (await db.moneyAccount.create({
      data: {
        companyId,
        branchId,
        type: "BANK",
        name: "Legacy test bank",
        ledgerAccountId: ledger.id,
      },
    }));
  const party = await db.customer.create({
    data: {
      companyId,
      branchId,
      name: "Legacy source customer",
      isAccountCustomer: true,
    },
  });
  const number = randomUUID().slice(0, 8);
  const legacy = await db.cheque.create({
    data: {
      companyId,
      branchId,
      moneyAccountId: bank.id,
      chequeNumber: number,
      chequeDate: new Date("2026-10-10"),
      partyName: "Unmapped legacy party",
      status: "RECEIVED",
    },
  });
  const journals = await db.journalEntry.count({ where: { companyId } });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/money/cheques");
  const card = page.getByRole("article", { name: `Cheque ${number}` });
  await card.getByText("Complete source details", { exact: true }).click();
  await card
    .getByLabel("Search original party", { exact: true })
    .fill(party.name);
  await card
    .getByRole("button", { name: "Find original party", exact: true })
    .click();
  await expect(
    card
      .getByLabel("Original party", { exact: true })
      .locator("option", { hasText: party.name }),
  ).toBeAttached({ timeout: 15000 });
  await card
    .getByLabel("Original party", { exact: true })
    .selectOption(party.id);
  await card
    .getByLabel("Original cheque amount", { exact: true })
    .fill("50.00");
  await card
    .getByRole("button", { name: "Confirm source details", exact: true })
    .click();
  await expect(
    card.getByRole("heading", { name: party.name, exact: true }),
  ).toBeVisible({ timeout: 15000 });
  const result = await db.cheque.findUniqueOrThrow({
    where: { id: legacy.id },
  });
  expect(result.amount?.toFixed(2)).toBe("50.00");
  expect(result.journalEntryId).toBeNull();
  expect(
    (
      await db.accountSettlement.findUniqueOrThrow({
        where: { id: result.settlementId! },
      })
    ).status,
  ).toBe("PENDING_CHEQUE");
  expect(await db.journalEntry.count({ where: { companyId } })).toBe(journals);
  expect(
    (await new AxeBuilder({ page }).include("article").analyze()).violations,
  ).toEqual([]);
});

test("sale details distinguish receipts, credits, advances and aggregate party balance at this viewport", async ({
  page,
}) => {
  await db.ledgerAccount.createMany({
    data: DEFAULT_LEDGER_ACCOUNTS.map((row) => ({ ...row, companyId })),
    skipDuplicates: true,
  });
  const party = await db.customer.create({
    data: {
      companyId,
      branchId,
      name: "Sale detail browser customer",
      isAccountCustomer: true,
    },
  });
  const actor = {
    id: userId,
    companyId,
    name: "Expense administrator",
    email,
    managerType: null,
    salesRole: null,
    role: "ACCOUNT_USER",
    accountRole: "ACCOUNT_ADMIN",
    isActive: true,
    accountAccessActive: true,
    salesAccessActive: false,
    branchAccessScope: "ALL_BRANCHES",
    branchIds: [],
  } as ProjectActor;
  async function sale(rate: string) {
    const row = await createCommercialDocumentForActor(actor, {
      type: "SALES_INVOICE",
      branchId,
      partyId: party.id,
      issueDate: "2026-10-10",
      idempotencyKey: randomUUID(),
      lines: [
        {
          lineType: "CUSTOM",
          itemName: "Detail service",
          quantity: "1",
          rate,
          taxRate: "0",
        },
      ],
    });
    await postCommercialDocumentForActor(actor, { documentId: row.id });
    return row;
  }
  const first = await sale("100"),
    second = await sale("200");
  await createSettlementForActor(actor, {
    type: "CUSTOMER_RECEIPT",
    branchId,
    partyId: party.id,
    paymentMode: "CASH",
    moneyAccountId: moneyId,
    amount: "40",
    transactionDate: "2026-10-10",
    idempotencyKey: randomUUID(),
    allocations: [{ documentId: first.id, amount: "40" }],
  });
  const line = await db.commercialDocumentLine.findFirstOrThrow({
    where: { companyId, documentId: first.id },
  });
  const credit = await createCommercialDocumentForActor(actor, {
    type: "CREDIT_NOTE",
    branchId,
    partyId: party.id,
    sourceDocumentId: first.id,
    issueDate: "2026-10-10",
    idempotencyKey: randomUUID(),
    lines: [
      {
        lineType: "CUSTOM",
        sourceCommercialLineId: line.id,
        itemName: "Credit",
        quantity: "1",
        rate: "20",
        taxRate: "0",
      },
    ],
  });
  await postCommercialDocumentForActor(actor, { documentId: credit.id });
  const advance = await createSettlementForActor(actor, {
    type: "CUSTOMER_ADVANCE",
    branchId,
    partyId: party.id,
    paymentMode: "CASH",
    moneyAccountId: moneyId,
    amount: "50",
    transactionDate: "2026-10-10",
    idempotencyKey: randomUUID(),
  });
  await applyAdvanceForActor(actor, {
    advanceId: advance.id,
    documentId: second.id,
    amount: "30",
    applicationDate: "2026-10-10",
    idempotencyKey: randomUUID(),
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto(`/workspace/account/sales/${first.id}`);
  await expect(
    page.getByText("Received", { exact: true }).locator(".."),
  ).toContainText(/40\.00/);
  await expect(
    page.getByText("Credit adjustments", { exact: true }).locator(".."),
  ).toContainText(/20\.00/);
  await expect(
    page.getByText("Balance Due", { exact: true }).locator(".."),
  ).toContainText(/40\.00/);
  await expect(page.getByText(/Party Balance:/)).toContainText(/190\.00/);
  await page.goto(`/workspace/account/sales/${second.id}`);
  await expect(
    page.getByText("Received", { exact: true }).locator(".."),
  ).toContainText(/0\.00/);
  await expect(
    page.getByText("Advance applied", { exact: true }).locator(".."),
  ).toContainText(/30\.00/);
  await expect(
    page.getByText("Balance Due", { exact: true }).locator(".."),
  ).toContainText(/170\.00/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("A054 native warehouse and product editors persist tracking metadata and deny unauthorized writes", async ({
  request,
}) => {
  const suffix = randomUUID().slice(0, 8),
    createdProducts: string[] = [],
    createdWarehouses: string[] = [];
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "A054 native parity",
    },
  });
  expect(login.status()).toBe(200);
  const headers = {
    authorization: `Bearer ${(await login.json()).accessToken}`,
  };
  try {
    const warehouse = await request.post(
      "/api/v1/mobile/account/master-data/warehouses",
      {
        headers,
        data: {
          branchId,
          name: `Parity warehouse ${suffix}`,
          code: `PARITY-${suffix}`,
          address: "Native warehouse address",
          isDefault: true,
        },
      },
    );
    expect(warehouse.status()).toBe(201);
    const savedWarehouse = await warehouse.json();
    createdWarehouses.push(savedWarehouse.id);
    expect(
      await db.warehouse.findUniqueOrThrow({
        where: { id: savedWarehouse.id },
      }),
    ).toMatchObject({
      companyId,
      branchId,
      address: "Native warehouse address",
      isDefault: true,
      isActive: true,
    });
    for (const trackingMode of ["BATCH", "SERIAL"] as const) {
      const product = await request.post(
        "/api/v1/mobile/account/master-data/items",
        {
          headers,
          data: {
            name: `Parity ${trackingMode} ${suffix}`,
            description: "Native retained description",
            sellingRate: "25",
            cost: "12",
            trackInventory: true,
            trackingMode,
            lowStockThreshold: 3,
          },
        },
      );
      expect(product.status()).toBe(201);
      const saved = await product.json();
      createdProducts.push(saved.id);
      expect(
        await db.accountProduct.findUniqueOrThrow({ where: { id: saved.id } }),
      ).toMatchObject({
        companyId,
        description: "Native retained description",
        trackInventory: true,
        trackingMode,
      });
      const kind = trackingMode === "BATCH" ? "batches" : "serials",
        fields =
          trackingMode === "BATCH"
            ? {
                batchNumber: `PARITY-${suffix}`,
                manufacturedDate: "2026-10-01",
              }
            : { serialNumber: `PARITY-${suffix}` };
      const catalog = await request.post(
        `/api/v1/mobile/account/inventory/${kind}`,
        {
          headers,
          data: { productId: saved.id, ...fields, expiryDate: "2027-10-01" },
        },
      );
      expect(catalog.status()).toBe(201);
      const row = await catalog.json();
      expect(row.expiryDate.slice(0, 10)).toBe("2027-10-01");
      if (trackingMode === "BATCH")
        expect(row.manufacturedDate.slice(0, 10)).toBe("2026-10-01");
      const invalid = await request.post(
        `/api/v1/mobile/account/inventory/${kind}`,
        {
          headers,
          data: { productId: saved.id, ...fields, expiryDate: "2026-02-30" },
        },
      );
      expect(invalid.ok()).toBe(false);
    }
    const deactivated = await request.patch(
      `/api/v1/mobile/account/master-data/warehouses/${savedWarehouse.id}`,
      {
        headers,
        data: {
          branchId,
          name: savedWarehouse.name,
          code: savedWarehouse.code,
          isActive: false,
          isDefault: true,
        },
      },
    );
    expect(deactivated.status()).toBe(200);
    expect(
      await db.warehouse.findUniqueOrThrow({
        where: { id: savedWarehouse.id },
      }),
    ).toMatchObject({ isActive: false, isDefault: false });
    await db.user.update({
      where: { id: userId },
      data: { accountRole: "PROJECT_MANAGER" },
    });
    const denied = await request.post(
      "/api/v1/mobile/account/master-data/warehouses",
      {
        headers,
        data: { branchId, name: "Denied warehouse", code: `DENIED-${suffix}` },
      },
    );
    expect(denied.status()).toBe(403);
    expect(
      await db.warehouse.count({
        where: { companyId, code: `DENIED-${suffix}` },
      }),
    ).toBe(0);
  } finally {
    await db.user.update({
      where: { id: userId },
      data: { accountRole: "ACCOUNT_ADMIN" },
    });
    await db.inventoryBatch.deleteMany({
      where: { companyId, productId: { in: createdProducts } },
    });
    await db.inventorySerialNumber.deleteMany({
      where: { companyId, productId: { in: createdProducts } },
    });
    await db.accountProduct.deleteMany({
      where: { companyId, id: { in: createdProducts } },
    });
    await db.warehouse.deleteMany({
      where: { companyId, id: { in: createdWarehouses } },
    });
  }
});

test("A058 entered inclusive pricing and discounts persist through web and native APIs", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const suffix = randomUUID().slice(0, 8),
    ids: string[] = [];
  const settings = await db.accountSettings.findUniqueOrThrow({
    where: { companyId },
  });
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/account/, { timeout: 20000 });
    await page.goto("/workspace/account/inventory/items/new");
    await page
      .getByLabel("Item Name *", { exact: true })
      .fill(`Pricing web ${suffix}`);
    await page.getByPlaceholder("Sale Price", { exact: true }).fill("118");
    await page
      .getByLabel("Sale Price Tax Mode", { exact: true })
      .selectOption("WITH");
    await page.getByPlaceholder("Purchase Price", { exact: true }).fill("59");
    await page
      .getByLabel("Purchase Price Tax Mode", { exact: true })
      .selectOption("WITH");
    await page.getByLabel("Tax Rate", { exact: true }).selectOption("18");
    await page.getByLabel("Sale Price Discount", { exact: true }).fill("11.8");
    await page
      .getByLabel("Sale Price Discount Type", { exact: true })
      .selectOption("AMOUNT");
    await page
      .getByRole("button", { name: "＋ Add Wholesale Price", exact: true })
      .click();
    await page.getByLabel("Wholesale Price", { exact: true }).fill("106.2");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(() =>
        db.accountProduct.count({
          where: { companyId, name: `Pricing web ${suffix}` },
        }),
      )
      .toBe(1);
    const web = await db.accountProduct.findFirstOrThrow({
      where: { companyId, name: `Pricing web ${suffix}` },
    });
    ids.push(web.id);
    expect(web.salePrice?.toFixed(2)).toBe("100.00");
    expect(web.costPrice?.toFixed(2)).toBe("50.00");
    expect(web.pricing).toMatchObject({
      saleTaxMode: "INCLUSIVE",
      enteredSalePrice: "118.00",
      normalizedDiscountValue: "10",
      normalizedWholesalePrice: "90.00",
    });
    await page.goto("/workspace/account/transactions/new?type=SALES_INVOICE");
    await page.getByRole("button", { name: /Add Items/ }).click();
    await page
      .getByRole("button", { name: new RegExp(`Pricing web ${suffix}`) })
      .click();
    await expect(
      page.getByLabel("Rate (Price/Unit)", { exact: true }),
    ).toHaveValue("100");
    await page.getByLabel("Quantity", { exact: true }).fill("3");
    await expect(page.getByLabel("Item Discount", { exact: true })).toHaveValue(
      "30",
    );
    await page
      .getByLabel("Price type", { exact: true })
      .selectOption("WHOLESALE");
    await expect(
      page.getByLabel("Rate (Price/Unit)", { exact: true }),
    ).toHaveValue("90");
    await expect(page.getByLabel("Item Discount", { exact: true })).toHaveValue(
      "30",
    );
    await page.getByLabel("Price type", { exact: true }).selectOption("RETAIL");
    await expect(
      page.getByLabel("Rate (Price/Unit)", { exact: true }),
    ).toHaveValue("100");
    await page.getByLabel("Item Discount", { exact: true }).fill("5");
    await page.getByLabel("Quantity", { exact: true }).fill("4");
    await expect(page.getByLabel("Item Discount", { exact: true })).toHaveValue(
      "5",
    );
    const login = await request.post("/api/v1/mobile/auth/login", {
      data: {
        identifier: email,
        password,
        deviceId: randomUUID(),
        deviceName: "Pricing parity",
      },
    });
    expect(login.status()).toBe(200);
    const headers = {
      authorization: `Bearer ${(await login.json()).accessToken}`,
    };
    const payload = {
      name: `Pricing native ${suffix}`,
      sellingRate: "118",
      cost: "59",
      taxRate: "18",
      pricing: {
        saleTaxMode: "INCLUSIVE",
        purchaseTaxMode: "INCLUSIVE",
        discountType: "PERCENTAGE",
        discountValue: "10",
        wholesalePrice: "106.20",
      },
      creationRequestKey: randomUUID(),
    };
    const first = await request.post(
      "/api/v1/mobile/account/master-data/items",
      { headers, data: payload },
    );
    expect(first.status()).toBe(201);
    const native = await first.json();
    ids.push(native.id);
    expect(native.salePrice).toBe("100");
    expect(native.pricing).toMatchObject({
      normalizedDiscountValue: "10",
      normalizedWholesalePrice: "90.00",
    });
    const replay = await request.post(
      "/api/v1/mobile/account/master-data/items",
      { headers, data: payload },
    );
    expect(replay.status()).toBe(201);
    expect((await replay.json()).id).toBe(native.id);
    const changed = await request.post(
      "/api/v1/mobile/account/master-data/items",
      {
        headers,
        data: {
          ...payload,
          pricing: { ...payload.pricing, discountValue: "11" },
        },
      },
    );
    expect(changed.ok()).toBe(false);
    const detail = await request.get(
      `/api/v1/mobile/account/master-data/items/${native.id}`,
      { headers },
    );
    expect(detail.status()).toBe(200);
    expect(JSON.stringify(await detail.json())).toContain("enteredSalePrice");
    const edited = await request.patch(
      `/api/v1/mobile/account/master-data/items/${native.id}`,
      {
        headers,
        data: {
          name: payload.name,
          sellingRate: "150",
          cost: "50",
          taxRate: "18",
        },
      },
    );
    expect(edited.status()).toBe(200);
    expect(
      await db.accountProduct.findUniqueOrThrow({ where: { id: native.id } }),
    ).toMatchObject({
      pricing: expect.objectContaining({
        enteredSalePrice: "177.00",
        saleTaxMode: "INCLUSIVE",
        discountType: "PERCENTAGE",
      }),
    });
    await db.accountSettings.update({
      where: { companyId },
      data: { itemSettings: { wholesalePrice: false } },
    });
    const disabled = await request.post(
      "/api/v1/mobile/account/master-data/items",
      {
        headers,
        data: {
          ...payload,
          name: "Forbidden pricing",
          creationRequestKey: randomUUID(),
        },
      },
    );
    expect(disabled.ok()).toBe(false);
    expect((await disabled.json()).error).toBe("WHOLESALE_PRICING_DISABLED");
  } finally {
    await db.accountSettings.update({
      where: { companyId },
      data: { itemSettings: settings.itemSettings ?? {} },
    });
    await db.accountProduct.deleteMany({
      where: {
        companyId,
        OR: [
          { id: { in: ids } },
          {
            name: { in: [`Pricing web ${suffix}`, `Pricing native ${suffix}`] },
          },
        ],
      },
    });
  }
});

test("A066 View Txn opens multi-invoice payments and advances without recognizing pending cheques", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const suffix = randomUUID().slice(0, 8),
    oldSettings = await db.accountSettings.findUniqueOrThrow({
      where: { companyId },
    });
  await db.accountSettings.update({
    where: { companyId },
    data: {
      enabledModules: [
        ...new Set([
          ...oldSettings.enabledModules,
          "CUSTOMER_ADVANCES" as const,
        ]),
      ],
    },
  });
  try {
    if (!(await db.financialYear.findFirst({ where: { companyId } })))
      await db.financialYear.create({
        data: {
          companyId,
          name: "Cheque navigation year",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
        },
      });
    for (const row of DEFAULT_LEDGER_ACCOUNTS)
      await db.ledgerAccount.upsert({
        where: { companyId_code: { companyId, code: row.code } },
        create: {
          companyId,
          code: row.code,
          name: `NAV ${row.name}`,
          accountClass: row.accountClass,
          normalBalance: row.normalBalance,
          systemKey: row.systemKey,
          isSystem: row.isSystem,
        },
        update: { systemKey: row.systemKey },
      });
    const actor = {
      ...(await db.user.findUniqueOrThrow({ where: { id: userId } })),
      companyId,
      branchIds: [],
    } as ProjectActor;
    const customer = await db.customer.create({
      data: {
        companyId,
        branchId,
        name: `Cheque target ${suffix}`,
        isAccountCustomer: true,
      },
    });
    const ledger = await db.ledgerAccount.create({
      data: {
        companyId,
        code: `NAV-${suffix}`,
        name: "Cheque navigation bank",
        accountClass: "ASSET",
        normalBalance: "DEBIT",
      },
    });
    const bank = await db.moneyAccount.create({
      data: {
        companyId,
        branchId,
        name: "Cheque navigation bank",
        type: "BANK",
        ledgerAccountId: ledger.id,
      },
    });
    const invoices = [];
    for (const rate of ["40", "60"]) {
      const draft = await createCommercialDocumentForActor(actor, {
        type: "SALES_INVOICE",
        branchId,
        partyId: customer.id,
        issueDate: "2026-10-10",
        lines: [
          {
            lineType: "CUSTOM",
            itemName: "Pending cheque navigation",
            quantity: "1",
            rate,
            taxRate: "0",
          },
        ],
      });
      await postCommercialDocumentForActor(actor, { documentId: draft.id });
      invoices.push(draft);
    }
    const payment = await createSettlementForActor(actor, {
      type: "CUSTOMER_RECEIPT",
      branchId,
      partyId: customer.id,
      moneyAccountId: bank.id,
      paymentMode: "CHEQUE",
      chequeNumber: `MULTI-${suffix}`,
      chequeDate: "2026-10-10",
      transactionDate: "2026-10-10",
      amount: "100",
      idempotencyKey: randomUUID(),
      allocations: invoices.map((x) => ({
        documentId: x.id,
        amount: x.grandTotal.toString(),
      })),
    });
    const advance = await createSettlementForActor(actor, {
      type: "CUSTOMER_ADVANCE",
      branchId,
      partyId: customer.id,
      moneyAccountId: bank.id,
      paymentMode: "CHEQUE",
      chequeNumber: `ADVANCE-${suffix}`,
      chequeDate: "2026-10-10",
      transactionDate: "2026-10-10",
      amount: "25",
      idempotencyKey: randomUUID(),
      allocations: [],
    });
    const login = await request.post("/api/v1/mobile/auth/login", {
      data: {
        identifier: email,
        password,
        deviceId: randomUUID(),
        deviceName: "Cheque source navigation",
      },
    });
    expect(login.status()).toBe(200);
    const response = await request.get(
      `/api/v1/mobile/account/money/cheques?branchId=${branchId}&q=${suffix}`,
      {
        headers: {
          authorization: `Bearer ${(await login.json()).accessToken}`,
        },
      },
    );
    expect(response.status()).toBe(200);
    const rows = (await response.json()).rows;
    expect(
      rows.find((x: { settlementId: string }) => x.settlementId === advance.id)
        .sourceTransaction.nativeHref,
    ).toBe(
      `/workspace/account/settlements/${advance.id}?type=CUSTOMER_ADVANCE`,
    );
    const before = await db.journalEntry.count({ where: { companyId } });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/account/, { timeout: 20000 });
    for (const [number, settlement] of [
      [`MULTI-${suffix}`, payment],
      [`ADVANCE-${suffix}`, advance],
    ] as const) {
      await page.goto(
        `/workspace/account/money/cheques?branchId=${branchId}&q=${number}`,
      );
      const card = page.getByRole("article", {
        name: `Cheque ${number}`,
        exact: true,
      });
      await expect(
        card.getByRole("link", { name: "View Txn", exact: true }),
      ).toHaveAttribute(
        "href",
        `/workspace/account/settlements/${settlement.id}`,
      );
      await card.getByRole("link", { name: "View Txn", exact: true }).click();
      await expect(
        page.getByRole("region", { name: "Payment details", exact: true }),
      ).toContainText("PENDING_CHEQUE", { timeout: 20000 });
    }
    const pdf = await page.request.get(
      `/api/account/print/CUSTOMER_ADVANCE/${advance.id}?format=pdf`,
    );
    expect(pdf.status()).toBe(200);
    expect((await extractPdfText(await pdf.body())).text).toContain(
      "PENDING CHEQUE",
    );
    expect(await db.journalEntry.count({ where: { companyId } })).toBe(before);
    for (const doc of invoices) {
      expect(
        (
          await db.$transaction((tx) =>
            documentOutstandingInTx(tx, companyId, doc.id),
          )
        ).outstanding.toFixed(2),
      ).toBe(doc.grandTotal.toFixed(2));
    }
    expect(
      await db.accountSettlement.findUniqueOrThrow({
        where: { id: advance.id },
      }),
    ).toMatchObject({ status: "PENDING_CHEQUE", journalEntryId: null });
    await db.user.update({
      where: { id: userId },
      data: { branchAccessScope: "SELECTED_BRANCHES" },
    });
    const permittedBranch = await db.branch.create({
      data: {
        companyId,
        code: `NAV-${suffix}`,
        name: `Other cheque branch ${suffix}`,
      },
    });
    await db.userBranchAccess.create({
      data: { userId, branchId: permittedBranch.id },
    });
    const denied = await page.request.get(
      `/workspace/account/settlements/${advance.id}`,
    );
    expect(denied.status()).toBe(404);
  } finally {
    await db.user.update({
      where: { id: userId },
      data: { accountRole: "ACCOUNT_ADMIN", branchAccessScope: "ALL_BRANCHES" },
    });
    await db.userBranchAccess.deleteMany({ where: { userId } });
    await db.accountSettings.update({
      where: { companyId },
      data: { enabledModules: oldSettings.enabledModules },
    });
  }
});
