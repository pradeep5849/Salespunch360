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
      enabledModules: ["PROJECTS", "PROJECT_COSTING", "INVENTORY"],
      negativeStockAllowed: false,
    },
  });
  await db.branch.create({
    data: {
      id: branchId,
      companyId,
      name: "Project branch",
      code: "PRIMARY",
      isPrimary: true,
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
    await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
    await tx.journalLine.deleteMany({ where: { companyId } });
    await tx.journalEntry.deleteMany({ where: { companyId } });
  });
  await db.projectChangeOrder.deleteMany({ where: { companyId } });
  await db.projectBudgetLine.deleteMany({ where: { companyId } });
  await db.project.deleteMany({ where: { companyId } });
  await db.customer.deleteMany({ where: { companyId } });
  await db.warehouse.deleteMany({ where: { companyId } });
  await db.inventoryBatch.deleteMany({ where: { companyId } });
  await db.accountProduct.deleteMany({ where: { companyId } });
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
  await db.accountSettings.update({
    where: { companyId },
    data: { enabledModules: ["INVENTORY"] },
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
