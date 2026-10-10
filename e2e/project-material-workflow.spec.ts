import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { expect, test } from "@playwright/test";
import { DEFAULT_LEDGER_ACCOUNTS } from "../src/lib/accounting/default-accounts";

const db = new PrismaClient();
const companyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  customerId = randomUUID();
const productId = randomUUID(),
  warehouseId = randomUUID(),
  projectA = randomUUID(),
  projectB = randomUUID(),
  budgetA = randomUUID();
const vendorId = randomUUID(),
  serviceId = randomUUID();
const batchProductId = randomUUID(),
  batchId = randomUUID();
const password = "Project-browser-fixture-934!",
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
      name: "Project browser fixture",
      slug: `project-browser-${companyId}`,
      productEdition: "SALESPUNCH360_ACCOUNT",
      subscriptionStatus: "TRIAL",
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  await db.accountSettings.create({
    data: {
      companyId,
      enabledModules: [
        "PROJECTS",
        "PROJECT_COSTING",
        "INVENTORY",
        "PURCHASES",
        "PURCHASE_BILLS",
        "DEBIT_NOTE",
      ],
      negativeStockAllowed: false,
      defaultStateCode: "29",
    },
  });
  await db.branch.create({
    data: {
      id: branchId,
      companyId,
      name: "Project branch",
      code: "PRIMARY",
      isPrimary: true,
      gstStateCode: "29",
    },
  });
  await db.user.create({
    data: {
      id: userId,
      companyId,
      name: "Project administrator",
      email,
      passwordHash: await hash(password),
      role: "ACCOUNT_USER",
      accountRole: "ACCOUNT_ADMIN",
      accountAccessActive: true,
      emailVerifiedAt: new Date(),
    },
  });
  await db.customer.create({
    data: {
      id: customerId,
      companyId,
      branchId,
      name: "Project customer",
      isAccountCustomer: true,
    },
  });
  await db.vendor.create({
    data: { id: vendorId, companyId, name: "Project supplier" },
  });
  await db.project.createMany({
    data: [
      {
        id: projectA,
        companyId,
        branchId,
        customerId,
        projectNumber: "PRJ-A",
        name: "Project A",
        status: "ACTIVE",
        createdById: userId,
      },
      {
        id: projectB,
        companyId,
        branchId,
        customerId,
        projectNumber: "PRJ-B",
        name: "Project B",
        status: "ACTIVE",
        createdById: userId,
      },
    ],
  });
  await db.projectBudgetLine.create({
    data: {
      id: budgetA,
      companyId,
      projectId: projectA,
      position: 0,
      category: "MATERIAL",
      title: "A material budget",
      amount: 1000,
    },
  });
  await db.accountProduct.create({
    data: {
      id: productId,
      companyId,
      name: "Project test material",
      code: "PM",
      trackInventory: true,
      costPrice: 10,
    },
  });
  await db.accountProduct.create({
    data: {
      id: batchProductId,
      companyId,
      name: "Tracked Project material",
      code: "BPM",
      trackInventory: true,
      trackingMode: "BATCH",
      costPrice: 10,
    },
  });
  await db.inventoryBatch.create({
    data: {
      id: batchId,
      companyId,
      productId: batchProductId,
      batchNumber: "BATCH-ONE",
      expiryDate: new Date("2027-01-01"),
    },
  });
  await db.warehouse.create({
    data: {
      id: warehouseId,
      companyId,
      branchId,
      name: "Project warehouse",
      code: "PW",
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
  await db.accountService.create({
    data: {
      id: serviceId,
      companyId,
      name: "Project billing service",
      code: "SERVICE",
      sellingRate: 100,
      taxRate: 18,
      sacCode: "995419",
    },
  });
  await db.ledgerAccount.createMany({
    data: DEFAULT_LEDGER_ACCOUNTS.map((x) => ({ ...x, companyId })),
  });
  await db.stockMovement.create({
    data: {
      companyId,
      branchId,
      productId: batchProductId,
      batchId,
      warehouseId,
      movementType: "OPENING",
      quantity: 2,
      unitCost: 10,
      totalCost: 20,
      sourceType: "FIXTURE",
      sourceId: randomUUID(),
      movementDate: new Date("2026-10-09"),
      createdById: userId,
    },
  });
  await db.stockMovement.create({
    data: {
      companyId,
      branchId,
      productId,
      warehouseId,
      movementType: "OPENING",
      quantity: 20,
      unitCost: 10,
      totalCost: 200,
      sourceType: "FIXTURE",
      sourceId: randomUUID(),
      movementDate: new Date("2026-10-09"),
      createdById: userId,
    },
  });
});

test.afterAll(async () => {
  await db.projectAuditEvent.deleteMany({ where: { companyId } });
  // Cleanup is restricted by beforeAll to the isolated browser fixture database.
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`ALTER TABLE "project_material_movements" DISABLE TRIGGER project_material_no_update_delete`;
    await tx.projectMaterialMovement.deleteMany({ where: { companyId } });
    await tx.$executeRaw`ALTER TABLE "project_material_movements" ENABLE TRIGGER project_material_no_update_delete`;
  });
  await db.stockMovement.deleteMany({ where: { companyId } });
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
    await tx.commercialAuditEvent.deleteMany({ where: { companyId } });
    await tx.purchaseLineAllocation.deleteMany({ where: { companyId } });
    await tx.commercialDocumentLine.deleteMany({ where: { companyId } });
    await tx.commercialDocument.deleteMany({ where: { companyId } });
    await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
    await tx.journalLine.deleteMany({ where: { companyId } });
    await tx.journalEntry.deleteMany({ where: { companyId } });
  });
  await db.projectChangeOrder.deleteMany({ where: { companyId } });
  await db.projectBudgetLine.deleteMany({ where: { companyId } });
  await db.project.deleteMany({ where: { companyId } });
  await db.vendor.deleteMany({ where: { companyId } });
  await db.customer.deleteMany({ where: { companyId } });
  await db.warehouse.deleteMany({ where: { companyId } });
  await db.inventoryBatch.deleteMany({ where: { companyId } });
  await db.accountProduct.deleteMany({ where: { companyId } });
  await db.accountService.deleteMany({ where: { companyId } });
  await db.ledgerAccount.deleteMany({ where: { companyId } });
  await db.financialYear.deleteMany({ where: { companyId } });
  await db.numberingSeries.deleteMany({ where: { companyId } });
  await db.user.deleteMany({ where: { companyId } });
  await db.branch.deleteMany({ where: { companyId } });
  await db.accountSettings.deleteMany({ where: { companyId } });
  await db.company.deleteMany({ where: { id: companyId } });
  await db.$disconnect();
});

test("Project links, material forms and API enforce the same scope and module rules", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/workspace\/account/);
  await page.goto("/workspace/account/projects/new");
  await page
    .getByRole("textbox", { name: "Project name", exact: true })
    .fill("Browser retry-safe Project");
  await page
    .getByRole("textbox", { name: "Project value", exact: true })
    .fill("100");
  const beforeCustomers = await db.customer.count({ where: { companyId } });
  const requestReference = await page
    .locator('input[name="idempotencyKey"]')
    .inputValue();
  // The server completes the first request, but the browser loses its response.
  await page.route("**/workspace/account/projects/new", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch();
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Connection interrupted" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Project name", exact: true }),
  ).toHaveValue("Browser retry-safe Project");
  expect(await page.locator('input[name="idempotencyKey"]').inputValue()).toBe(
    requestReference,
  );
  await page.unroute("**/workspace/account/projects/new");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page).toHaveURL(/projects\/[0-9a-f-]{36}$/);
  expect(
    await db.project.count({
      where: { companyId, name: "Browser retry-safe Project" },
    }),
  ).toBe(1);
  expect(await db.customer.count({ where: { companyId } })).toBe(
    beforeCustomers + 1,
  );
  await page.goto(`/workspace/account/projects/material?projectId=${projectB}`);
  await expect(
    page.getByRole("combobox", { name: "Project", exact: true }),
  ).toHaveValue(projectB);
  await page
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption(projectA);
  await expect(page).toHaveURL(new RegExp(`projectId=${projectA}`));
  await page
    .getByRole("combobox", { name: "Product", exact: true })
    .selectOption(productId);
  await page
    .getByRole("combobox", { name: "Budget line", exact: true })
    .selectOption(budgetA);
  await page
    .getByRole("combobox", { name: "Warehouse", exact: true })
    .selectOption(warehouseId);
  await page
    .getByRole("spinbutton", { name: "Quantity", exact: true })
    .fill("2");
  await page
    .getByRole("button", { name: "Post movement", exact: true })
    .click();
  await expect
    .poll(() =>
      db.projectMaterialMovement.count({
        where: {
          companyId,
          projectId: projectA,
          movementType: "INVENTORY_ISSUE_TO_PROJECT",
        },
      }),
    )
    .toBe(1);
  await expect(
    page.getByRole("status").filter({ hasText: "Material movement saved" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Action", exact: true })
    .selectOption("CONSUME");
  const source = await db.projectMaterialMovement.findFirstOrThrow({
    where: { companyId, projectId: projectA },
  });
  await page
    .getByRole("combobox", { name: "Original material", exact: true })
    .selectOption(source.id);
  await page
    .getByRole("spinbutton", { name: "Quantity", exact: true })
    .fill("3");
  await page
    .getByRole("button", { name: "Post movement", exact: true })
    .click();
  expect(
    await db.projectMaterialMovement.count({
      where: { companyId, movementType: "CONSUMPTION" },
    }),
  ).toBe(0);
  await page
    .getByRole("spinbutton", { name: "Quantity", exact: true })
    .fill("1");
  await page
    .getByRole("button", { name: "Post movement", exact: true })
    .click();
  await expect
    .poll(() =>
      db.projectMaterialMovement.count({
        where: { companyId, movementType: "CONSUMPTION" },
      }),
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.goto(`/workspace/account/projects/material?projectId=${projectA}`);
  await page
    .getByRole("combobox", { name: "Product", exact: true })
    .selectOption(batchProductId);
  await expect(
    page.getByRole("combobox", { name: "Batch", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("combobox", { name: "Batch", exact: true })
      .getByRole("option", { name: /BATCH-ONE/ }),
  ).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Batch", exact: true })
    .selectOption(batchId);
  await page
    .getByRole("combobox", { name: "Budget line", exact: true })
    .selectOption(budgetA);
  await page
    .getByRole("combobox", { name: "Warehouse", exact: true })
    .selectOption(warehouseId);
  await page
    .getByRole("spinbutton", { name: "Quantity", exact: true })
    .fill("1");
  await page
    .getByRole("button", { name: "Post movement", exact: true })
    .click();
  await expect
    .poll(() =>
      db.projectMaterialMovement.count({
        where: { companyId, productId: batchProductId, batchId },
      }),
    )
    .toBe(1);
  await page.goto(`/workspace/account/projects/${projectA}/costing`);
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Browser extra work");
  await page
    .getByRole("textbox", { name: "Contract value change", exact: true })
    .fill("100");
  await page
    .getByRole("textbox", { name: "Estimated cost change", exact: true })
    .fill("20");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect
    .poll(() =>
      db.projectChangeOrder.count({
        where: { companyId, projectId: projectA, title: "Browser extra work" },
      }),
    )
    .toBe(1);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await db.projectChangeOrder.findFirstOrThrow({
            where: { companyId, projectId: projectA },
          })
        ).status,
    )
    .toBe("PENDING_APPROVAL");
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("A different administrator must approve this change order."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  const login = await page.request.post("/api/v1/mobile/auth/login", {
    data: { identifier: email, password, deviceId: randomUUID() },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json(),
    headers = { authorization: `Bearer ${session.accessToken}` };
  const context = await page.request.get(
    `/api/v1/mobile/account/project-material?projectId=${projectA}`,
    { headers },
  );
  expect(context.status()).toBe(200);
  const body = await context.json();
  expect(body.sources[0].availableQuantity).toBe("1");
  const purchaseResponse = await page.request.post(
    "/api/v1/mobile/account/purchases",
    {
      headers,
      data: {
        type: "PURCHASE_BILL",
        branchId,
        partyId: vendorId,
        projectId: projectA,
        projectBudgetLineId: budgetA,
        purchasePurpose: "PROJECT",
        materialTreatment: "DIRECT_TO_PROJECT",
        vendorInvoiceNumber: randomUUID(),
        vendorInvoiceDate: "2026-10-09",
        issueDate: "2026-10-09",
        lines: [
          {
            lineType: "MATERIAL",
            sourceId: productId,
            warehouseId,
            quantity: "5",
            rate: "10",
            taxRate: "0",
          },
        ],
      },
    },
  );
  expect(purchaseResponse.status()).toBe(201);
  const purchase = await purchaseResponse.json();
  expect(
    (
      await page.request.post(
        `/api/v1/mobile/account/purchases/${purchase.id}/post`,
        { headers },
      )
    ).status(),
  ).toBe(200);
  const sourceLine = await db.commercialDocumentLine.findFirstOrThrow({
    where: { companyId, documentId: purchase.id },
  });
  const trackedPurchaseResponse = await page.request.post(
    "/api/v1/mobile/account/purchases",
    {
      headers,
      data: {
        type: "PURCHASE_BILL",
        branchId,
        partyId: vendorId,
        purchasePurpose: "INVENTORY_SALES",
        vendorInvoiceNumber: randomUUID(),
        vendorInvoiceDate: "2026-10-09",
        issueDate: "2026-10-09",
        lines: [
          {
            lineType: "MATERIAL",
            sourceId: batchProductId,
            warehouseId,
            batchId,
            quantity: "1",
            rate: "10",
            taxRate: "0",
          },
        ],
      },
    },
  );
  expect(trackedPurchaseResponse.status()).toBe(201);
  const trackedPurchase = await trackedPurchaseResponse.json();
  expect(
    (
      await page.request.post(
        `/api/v1/mobile/account/purchases/${trackedPurchase.id}/post`,
        { headers },
      )
    ).status(),
  ).toBe(200);
  const purchaseOptionsResponse = await page.request.get(
    "/api/v1/mobile/account/purchases/options",
    { headers },
  );
  expect(purchaseOptionsResponse.status()).toBe(200);
  const purchaseOptions = await purchaseOptionsResponse.json();
  const trackedSource = purchaseOptions.sourceDocuments.find(
    (source: { id: string }) => source.id === trackedPurchase.id,
  );
  expect(trackedSource.lines[0]).toMatchObject({
    warehouseId,
    batchId,
    serialNumberId: null,
  });
  const correctionInput = {
    type: "DEBIT_NOTE",
    branchId,
    partyId: vendorId,
    purchasePurpose: "PROJECT",
    sourceDocumentId: purchase.id,
    issueDate: "2026-10-09",
    lines: [
      {
        lineType: "MATERIAL",
        sourceId: productId,
        warehouseId,
        sourceCommercialLineId: sourceLine.id,
        stockReturnQuantity: "1",
        quantity: "1",
        rate: "10",
      },
    ],
  };
  const correctionResponse = await page.request.post(
    "/api/v1/mobile/account/purchases",
    { headers, data: correctionInput },
  );
  expect(correctionResponse.status()).toBe(201);
  const correction = await correctionResponse.json();
  expect(
    (
      await page.request.post(
        `/api/v1/mobile/account/purchases/${correction.id}/post`,
        { headers },
      )
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post(
        `/api/v1/mobile/account/purchases/${correction.id}/post`,
        { headers },
      )
    ).status(),
  ).toBe(200);
  expect(
    await db.projectMaterialMovement.count({
      where: {
        companyId,
        correctionDocumentId: correction.id,
        movementType: "RETURN_TO_VENDOR",
      },
    }),
  ).toBe(1);
  const afterReturn = await (
    await page.request.get(
      `/api/v1/mobile/account/project-material?projectId=${projectA}`,
      { headers },
    )
  ).json();
  expect(
    afterReturn.sources.find(
      (x: { purchaseDocumentId?: string }) =>
        x.purchaseDocumentId === purchase.id,
    ).availableQuantity,
  ).toBe("4");
  await db.accountSettings.update({
    where: { companyId },
    data: {
      enabledModules: [
        "INVENTORY",
        "PURCHASES",
        "PURCHASE_BILLS",
        "DEBIT_NOTE",
      ],
    },
  });
  expect(
    (
      await page.request.get(
        `/api/v1/mobile/account/project-material?projectId=${projectA}`,
        { headers },
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/v1/mobile/account/project-material", {
        headers,
        data: { action: "ISSUE", payload: { projectId: projectA } },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(
        `/api/v1/mobile/account/purchases/${correction.id}/post`,
        { headers },
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/v1/mobile/account/purchases", {
        headers,
        data: correctionInput,
      })
    ).status(),
  ).toBe(403);
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/workspace\/account/);
  const deniedPage = await page.goto(
    `/workspace/account/projects/material?projectId=${projectA}`,
  );
  expect(deniedPage?.status()).toBe(404);
  await expect(
    page.getByRole("button", { name: "Post movement", exact: true }),
  ).toHaveCount(0);
});

test("purchase draft creation survives a lost response without duplicate documents", async ({
  page,
}) => {
  await db.accountSettings.update({
    where: { companyId },
    data: {
      enabledModules: [
        "PROJECTS",
        "PROJECT_COSTING",
        "INVENTORY",
        "PURCHASES",
        "PURCHASE_BILLS",
        "DEBIT_NOTE",
      ],
    },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/workspace\/account/);
  await page.goto("/workspace/account/transactions/new?type=PURCHASE_BILL");
  await page
    .getByRole("combobox", { name: "Vendor", exact: true })
    .selectOption(vendorId);
  const invoiceNumber = randomUUID();
  await page
    .getByRole("textbox", { name: "Vendor invoice number", exact: true })
    .fill(invoiceNumber);
  await page
    .getByLabel("Vendor invoice date", { exact: true })
    .fill("2026-10-09");
  await page
    .getByRole("combobox", { name: "Line type", exact: true })
    .selectOption("MATERIAL");
  await page
    .getByRole("combobox", { name: "Item", exact: true })
    .selectOption(productId);
  await page
    .getByRole("combobox", { name: "Warehouse", exact: true })
    .selectOption(warehouseId);
  await page.getByRole("spinbutton", { name: "Rate", exact: true }).fill("10");
  await page.route("**/workspace/account/transactions/new**", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch();
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Create Draft", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Connection interrupted" }),
  ).toBeVisible();
  const created = await db.commercialDocument.findFirstOrThrow({
    where: { companyId, vendorInvoiceNumber: invoiceNumber },
  });
  expect(created.creationRequestKey).toBeTruthy();
  await expect(
    page.getByRole("textbox", { name: "Vendor invoice number", exact: true }),
  ).toHaveValue(invoiceNumber);
  await page.unroute("**/workspace/account/transactions/new**");
  await page.getByRole("button", { name: "Create Draft", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/transactions/${created.id}$`));
  expect(
    await db.commercialDocument.count({
      where: { companyId, vendorInvoiceNumber: invoiceNumber },
    }),
  ).toBe(1);
  expect(
    await db.commercialAuditEvent.count({
      where: {
        companyId,
        entityId: created.id,
        eventType: "DOCUMENT_CREATED",
      },
    }),
  ).toBe(1);
});

test("Project invoice entry links customer and retries GST revenue exactly once", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await db.accountSettings.update({
    where: { companyId },
    data: {
      enabledModules: [
        "PROJECTS",
        "PROJECT_COSTING",
        "INVENTORY",
        "PURCHASES",
        "PURCHASE_BILLS",
        "DEBIT_NOTE",
        "SALES",
      ],
    },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/workspace\/account/);
  await page.goto(
    "/workspace/account/transactions/new?type=SALES_INVOICE&project=select",
  );
  await page
    .getByRole("combobox", { name: "Project *", exact: true })
    .selectOption(projectA);
  await expect(
    page.getByPlaceholder("Search customer name or phone"),
  ).toHaveValue("Project customer");
  await expect(
    page.getByPlaceholder("Search customer name or phone"),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Add Items/ }).click();
  await page
    .getByRole("button")
    .filter({ hasText: "Project billing service" })
    .click();
  const itemEntry = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Add Items to Sale",
      exact: true,
    }),
  });
  await itemEntry.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Add Items to Sale", exact: true }),
  ).toHaveCount(0);
  await page.route("**/workspace/account/transactions/new**", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch();
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be saved" }),
  ).toBeVisible();
  const invoice = await db.commercialDocument.findFirstOrThrow({
    where: { companyId, projectId: projectA, type: "SALES_INVOICE" },
    include: { lines: true },
  });
  expect(invoice).toMatchObject({ status: "POSTED", branchId, customerId });
  expect(invoice.lines[0].hsnSacCode).toBe("995419");
  expect(invoice.grandTotal.toString()).toBe("118");
  await page.unroute("**/workspace/account/transactions/new**");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Preview", exact: true }),
  ).toBeVisible();
  expect(
    await db.commercialDocument.count({
      where: { companyId, projectId: projectA, type: "SALES_INVOICE" },
    }),
  ).toBe(1);
  const journals = await db.journalEntry.findMany({
    where: { companyId, sourceId: invoice.id },
    include: { lines: { include: { ledgerAccount: true } } },
  });
  expect(journals).toHaveLength(1);
  expect(
    journals[0].lines
      .find((line) => line.ledgerAccount.systemKey === "SALES_INCOME")
      ?.credit.toString(),
  ).toBe("100");
  expect(
    journals[0].lines
      .find((line) => line.ledgerAccount.systemKey === "ACCOUNTS_RECEIVABLE")
      ?.debit.toString(),
  ).toBe("118");
  await page.goto(`/workspace/account/projects/${projectA}/costing`);
  await expect(
    page.getByRole("heading", {
      name: "Invoices and customer balance",
      exact: true,
    }),
  ).toBeVisible();
  const invoiceTable = page
    .getByRole("table")
    .filter({ has: page.getByText(invoice.documentNumber, { exact: true }) });
  await expect(
    invoiceTable.getByRole("cell", { name: "100.00", exact: true }),
  ).toBeVisible();
  await expect(
    invoiceTable.getByRole("cell", { name: "18.00", exact: true }),
  ).toBeVisible();
  await expect(
    invoiceTable.getByRole("cell", { name: "118.00", exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("heading", {
      name: "Labour and other expenses",
      exact: true,
    }),
  ).toBeVisible();
  await db.accountSettings.update({
    where: { companyId },
    data: { enabledModules: ["SALES", "INVENTORY"] },
  });
  const denied = await page.goto(
    "/workspace/account/transactions/new?type=SALES_INVOICE&project=select",
  );
  expect(denied?.status()).toBe(404);
  const normalSale = await page.goto(
    "/workspace/account/transactions/new?type=SALES_INVOICE",
  );
  expect(normalSale?.status()).toBe(200);
});

test("Project closure bills the remaining contract once after a lost response and the native API returns the same closed result", async ({page}) => {
  test.setTimeout(60_000);
  await db.accountSettings.update({where: {companyId}, data: {enabledModules: ["PROJECTS", "PROJECT_COSTING", "SALES", "INVENTORY"]}});
  const project = await db.project.create({data: {companyId, branchId, customerId, projectNumber: `CLOSE-${randomUUID()}`, name: "Browser final balance", projectValue: 100, status: "ACTIVE", createdById: userId}});
  await page.goto("/sign-in");
  await page.getByLabel("Email", {exact: true}).fill(email);
  await page.getByLabel("Password", {exact: true}).fill(password);
  await page.getByRole("button", {name: "Sign In", exact: true}).click();
  await expect(page).toHaveURL(/workspace\/account/);
  const path = `/workspace/account/projects/${project.id}`;
  await page.goto(path);
  await page.getByRole("combobox", {name: "Final invoice service / SAC", exact: true}).selectOption(serviceId);
  await page.route(`**${path}`, async route => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch();
    await route.abort("failed");
  });
  await page.getByRole("button", {name: "Complete project", exact: true}).click();
  await expect(page.getByRole("alert").filter({hasText: "Connection interrupted"})).toBeVisible();
  await expect(page.getByRole("combobox", {name: "Final invoice service / SAC", exact: true})).toHaveValue(serviceId);
  await page.unroute(`**${path}`);
  await page.getByRole("button", {name: "Complete project", exact: true}).click();
  await expect(page.getByRole("heading", {name: "Final project report", exact: true})).toBeVisible();
  const docs = await db.commercialDocument.findMany({where: {companyId, projectId: project.id}});
  expect(docs).toHaveLength(1);
  expect(docs[0].status).toBe("POSTED");
  expect(docs[0].taxableTotal.toString()).toBe("100");
  expect(docs[0].grandTotal.toString()).toBe("118");
  const login = await page.request.post("/api/v1/mobile/auth/login", {data: {identifier: email, password, deviceId: randomUUID()}});
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const result = await page.request.post(`/api/v1/mobile/account/projects/${project.id}/action`, {headers: {authorization: `Bearer ${session.accessToken}`}, data: {action: "COMPLETE", billingServiceId: serviceId}});
  expect(result.ok()).toBeTruthy();
  expect((await result.json()).status).toBe("CLOSED");
  expect(await db.commercialDocument.count({where: {companyId, projectId: project.id}})).toBe(1);
});
