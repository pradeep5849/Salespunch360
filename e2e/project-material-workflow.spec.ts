import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { expect, test } from "@playwright/test";
import { DEFAULT_LEDGER_ACCOUNTS } from "../src/lib/accounting/default-accounts";

const db = new PrismaClient();
const companyId = randomUUID(), branchId = randomUUID(), userId = randomUUID(), customerId = randomUUID();
const productId = randomUUID(), warehouseId = randomUUID(), projectA = randomUUID(), projectB = randomUUID(), budgetA = randomUUID();
const password = "Project-browser-fixture-934!", email = `${userId}@example.test`;

test.beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_ci")) throw new Error("Isolated local *_ci database required");
  await db.company.create({data: {id: companyId, name: "Project browser fixture", slug: `project-browser-${companyId}`, productEdition: "SALESPUNCH360_ACCOUNT", subscriptionStatus: "TRIAL", trialStartedAt: new Date(), trialEndsAt: new Date(Date.now() + 7 * 86400000)}});
  await db.accountSettings.create({data: {companyId, enabledModules: ["PROJECTS", "PROJECT_COSTING", "INVENTORY"], negativeStockAllowed: false}});
  await db.branch.create({data: {id: branchId, companyId, name: "Project branch", code: "PRIMARY", isPrimary: true}});
  await db.user.create({data: {id: userId, companyId, name: "Project administrator", email, passwordHash: await hash(password), role: "ACCOUNT_USER", accountRole: "ACCOUNT_ADMIN", accountAccessActive: true, emailVerifiedAt: new Date()}});
  await db.customer.create({data: {id: customerId, companyId, branchId, name: "Project customer", isAccountCustomer: true}});
  await db.project.createMany({data: [{id: projectA, companyId, branchId, customerId, projectNumber: "PRJ-A", name: "Project A", status: "ACTIVE", createdById: userId}, {id: projectB, companyId, branchId, customerId, projectNumber: "PRJ-B", name: "Project B", status: "ACTIVE", createdById: userId}]});
  await db.projectBudgetLine.create({data: {id: budgetA, companyId, projectId: projectA, position: 0, category: "MATERIAL", title: "A material budget", amount: 1000}});
  await db.accountProduct.create({data: {id: productId, companyId, name: "Project test material", code: "PM", trackInventory: true, costPrice: 10}});
  await db.warehouse.create({data: {id: warehouseId, companyId, branchId, name: "Project warehouse", code: "PW"}});
  await db.financialYear.create({data: {companyId, name: "2026-27", startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31")}});
  await db.ledgerAccount.createMany({data: DEFAULT_LEDGER_ACCOUNTS.map(x => ({...x, companyId}))});
  await db.stockMovement.create({data: {companyId, branchId, productId, warehouseId, movementType: "OPENING", quantity: 20, unitCost: 10, totalCost: 200, sourceType: "FIXTURE", sourceId: randomUUID(), movementDate: new Date("2026-10-09"), createdById: userId}});
});

test.afterAll(async () => {
  await db.projectAuditEvent.deleteMany({where: {companyId}});
  // Cleanup is restricted by beforeAll to the isolated browser fixture database.
  await db.$transaction(async tx => {
    await tx.$executeRaw`ALTER TABLE "project_material_movements" DISABLE TRIGGER project_material_no_update_delete`;
    await tx.projectMaterialMovement.deleteMany({where: {companyId}});
    await tx.$executeRaw`ALTER TABLE "project_material_movements" ENABLE TRIGGER project_material_no_update_delete`;
  });
  await db.stockMovement.deleteMany({where: {companyId}});
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
    await tx.accountingAuditEvent.deleteMany({where: {companyId}});
    await tx.journalLine.deleteMany({where: {companyId}});
    await tx.journalEntry.deleteMany({where: {companyId}});
  });
  await db.projectBudgetLine.deleteMany({where: {companyId}});
  await db.project.deleteMany({where: {companyId}});
  await db.customer.deleteMany({where: {companyId}});
  await db.warehouse.deleteMany({where: {companyId}});
  await db.accountProduct.deleteMany({where: {companyId}});
  await db.ledgerAccount.deleteMany({where: {companyId}});
  await db.financialYear.deleteMany({where: {companyId}});
  await db.numberingSeries.deleteMany({where: {companyId}});
  await db.user.deleteMany({where: {companyId}});
  await db.branch.deleteMany({where: {companyId}});
  await db.accountSettings.deleteMany({where: {companyId}});
  await db.company.deleteMany({where: {id: companyId}});
  await db.$disconnect();
});

test("Project links, material forms and API enforce the same scope and module rules", async ({page}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", {exact: true}).fill(email);
  await page.getByLabel("Password", {exact: true}).fill(password);
  await page.getByRole("button", {name: "Sign In", exact: true}).click();
  await expect(page).toHaveURL(/workspace\/account/);
  await page.goto(`/workspace/account/projects/material?projectId=${projectB}`);
  await expect(page.getByRole("combobox", {name: "Project", exact: true})).toHaveValue(projectB);
  await page.getByRole("combobox", {name: "Project", exact: true}).selectOption(projectA);
  await expect(page).toHaveURL(new RegExp(`projectId=${projectA}`));
  await page.getByRole("combobox", {name: "Product", exact: true}).selectOption(productId);
  await page.getByRole("combobox", {name: "Budget line", exact: true}).selectOption(budgetA);
  await page.getByRole("combobox", {name: "Warehouse", exact: true}).selectOption(warehouseId);
  await page.getByRole("spinbutton", {name: "Quantity", exact: true}).fill("2");
  await page.getByRole("button", {name: "Post movement", exact: true}).click();
  await expect.poll(() => db.projectMaterialMovement.count({where: {companyId, projectId: projectA, movementType: "INVENTORY_ISSUE_TO_PROJECT"}})).toBe(1);
  await page.getByRole("combobox", {name: "Action", exact: true}).selectOption("CONSUME");
  const source = await db.projectMaterialMovement.findFirstOrThrow({where: {companyId, projectId: projectA}});
  await page.getByRole("combobox", {name: "Original material", exact: true}).selectOption(source.id);
  await page.getByRole("spinbutton", {name: "Quantity", exact: true}).fill("3");
  await page.getByRole("button", {name: "Post movement", exact: true}).click();
  expect(await db.projectMaterialMovement.count({where: {companyId, movementType: "CONSUMPTION"}})).toBe(0);
  await page.getByRole("spinbutton", {name: "Quantity", exact: true}).fill("1");
  await page.getByRole("button", {name: "Post movement", exact: true}).click();
  await expect.poll(() => db.projectMaterialMovement.count({where: {companyId, movementType: "CONSUMPTION"}})).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  const login = await page.request.post("/api/v1/mobile/auth/login", {data: {identifier: email, password, deviceId: randomUUID()}});
  expect(login.ok()).toBeTruthy();
  const session = await login.json(), headers = {authorization: `Bearer ${session.accessToken}`};
  const context = await page.request.get(`/api/v1/mobile/account/project-material?projectId=${projectA}`, {headers});
  expect(context.status()).toBe(200);
  const body = await context.json();
  expect(body.sources[0].availableQuantity).toBe("1");
  await db.accountSettings.update({where: {companyId}, data: {enabledModules: ["INVENTORY"]}});
  expect((await page.request.get(`/api/v1/mobile/account/project-material?projectId=${projectA}`, {headers})).status()).toBe(403);
  expect((await page.request.post("/api/v1/mobile/account/project-material", {headers, data: {action: "ISSUE", payload: {projectId: projectA}}})).status()).toBe(403);
  await page.goto("/sign-in");
  await page.getByLabel("Email", {exact: true}).fill(email);
  await page.getByLabel("Password", {exact: true}).fill(password);
  await page.getByRole("button", {name: "Sign In", exact: true}).click();
  await expect(page).toHaveURL(/workspace\/account/);
  const deniedPage = await page.goto(`/workspace/account/projects/material?projectId=${projectA}`);
  expect(deniedPage?.status()).toBe(404);
  await expect(page.getByRole("button", {name: "Post movement", exact: true})).toHaveCount(0);
});
