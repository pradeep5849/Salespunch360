import { readFile } from "node:fs/promises";
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
  await db.ownerTransaction.deleteMany({ where: { companyId } });
  await db.ownerFinancialAccount.deleteMany({ where: { companyId } });
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
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    attachment.click(),
  ]);
  const downloadedFile = await download.path();
  expect(downloadedFile).not.toBeNull();
  expect(await readFile(downloadedFile!)).toEqual(receipt);
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
      categoryId: expenseCategory,
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
      categoryId: expenseCategory,
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
  await page.goto("/workspace/account/expenses");
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
    `/api/v1/mobile/account/expenses?page=1&branchId=${branchId}`,
    { headers },
  );
  expect(first.status()).toBe(200);
  const firstData = await first.json();
  expect(firstData.rows.length).toBe(50);
  expect(firstData.total).toBe(205);
  expect(firstData.nextOffset).toBe(50);
  const terminal = await request.get(
    `/api/v1/mobile/account/expenses?page=1&branchId=${branchId}&offset=200`,
    { headers },
  );
  const last = await terminal.json();
  expect(last.rows.length).toBe(5);
  expect(last.nextOffset).toBeNull();
  const older = await request.get(
    `/api/v1/mobile/account/expenses?page=1&branchId=${branchId}&q=old-search-target&type=OFFICE_EXPENSE&status=DRAFT`,
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
  await expect(page).toHaveURL(/\/workspace\/account/);
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
  await expect(page).toHaveURL(/\/money\/capital$/);
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
    "Shown separately from asset values",
  );
  await capitalSummary
    .getByRole("link", { name: "View Capital & Drawings" })
    .click();
  await expect(page).toHaveURL(/\/money\/capital$/);
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
