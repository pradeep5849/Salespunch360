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
  await db.customFieldDefinition.createMany({
    data: [
      {
        companyId,
        entityType: "CUSTOMER",
        fieldKey: "contact_note",
        label: "Contact note",
        dataType: "TEXT",
        isRequired: true,
        position: 1,
      },
      {
        companyId,
        entityType: "CUSTOMER",
        fieldKey: "site_notes",
        label: "Site notes",
        dataType: "TEXTAREA",
        isRequired: true,
        position: 2,
      },
      {
        companyId,
        entityType: "CUSTOMER",
        fieldKey: "floor_number",
        label: "Floor number",
        dataType: "NUMBER",
        isRequired: true,
        position: 3,
      },
      {
        companyId,
        entityType: "CUSTOMER",
        fieldKey: "exact_decimal",
        label: "Exact decimal",
        dataType: "DECIMAL",
        isRequired: true,
        position: 4,
      },
      {
        companyId,
        entityType: "CUSTOMER",
        fieldKey: "effective_date",
        label: "Effective date",
        dataType: "DATE",
        isRequired: true,
        position: 5,
      },
      {
        companyId,
        entityType: "CUSTOMER",
        fieldKey: "requires_review",
        label: "Requires review",
        dataType: "BOOLEAN",
        isRequired: true,
        position: 6,
      },
      {
        companyId,
        entityType: "CUSTOMER",
        fieldKey: "customer_group",
        label: "Customer group",
        dataType: "SELECT",
        options: ["Domestic", "Export"],
        isRequired: true,
        position: 7,
      },
      {
        companyId,
        entityType: "VENDOR",
        fieldKey: "supplier_group",
        label: "Supplier group",
        dataType: "SELECT",
        options: ["Materials", "Services"],
        isRequired: true,
        position: 1,
      },
    ],
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
test("shared master controls accept fractions and configured field types without partial writes", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/products");
  await page
    .getByLabel("Name", { exact: true })
    .fill("Fractional browser product");
  await page.getByLabel("Selling rate", { exact: true }).fill("12.50");
  await page.getByLabel("Estimated / cost rate", { exact: true }).fill("4.25");
  await page.getByLabel("GST %", { exact: true }).fill("2.50");
  expect(
    await page
      .getByLabel("Selling rate", { exact: true })
      .evaluate((e: HTMLInputElement) => e.checkValidity()),
  ).toBe(true);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Fractional browser product",
      exact: true,
    }),
  ).toBeVisible();
  const product = await db.accountProduct.findFirstOrThrow({
    where: { companyId, name: "Fractional browser product" },
  });
  expect(product.salePrice?.toFixed(2)).toBe("12.50");
  await page.goto("/workspace/account/customers");
  await page
    .getByLabel("Business name", { exact: true })
    .fill("Typed field customer");
  await page.getByLabel("Contact note", { exact: true }).fill("Preserved text");
  await page
    .getByLabel("Site notes", { exact: true })
    .fill("Line one\nLine two");
  await page.getByLabel("Floor number", { exact: true }).fill("1.25");
  await page.getByLabel("Exact decimal", { exact: true }).fill("1.250001");
  await page.getByLabel("Effective date", { exact: true }).fill("2026-10-09");
  await page
    .getByLabel("Requires review", { exact: true })
    .selectOption("false");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  expect(
    await db.customer.count({
      where: { companyId, name: "Typed field customer" },
    }),
  ).toBe(0);
  await page
    .getByLabel("Customer group", { exact: true })
    .selectOption("Export");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Typed field customer", exact: true }),
  ).toBeVisible();
  const customer = await db.customer.findFirstOrThrow({
    where: { companyId, name: "Typed field customer" },
  });
  const values = await db.customFieldValue.findMany({
    where: { companyId, entityId: customer.id },
    include: { definition: true },
  });
  expect(
    Object.fromEntries(values.map((v) => [v.definition.fieldKey, v.value])),
  ).toEqual({
    contact_note: "Preserved text",
    site_notes: "Line one\nLine two",
    floor_number: 1.25,
    exact_decimal: "1.250001",
    effective_date: "2026-10-09",
    requires_review: false,
    customer_group: "Export",
  });
});
test("mobile definitions match entity required flags and select/boolean semantics", async ({
  request,
}) => {
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Master browser API",
    },
  });
  expect(login.status()).toBe(200);
  const { accessToken } = await login.json();
  const headers = { authorization: `Bearer ${accessToken}` };
  const response = await request.get(
    "/api/v1/mobile/account/master-data/vendors?view=options",
    { headers },
  );
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.partyCustomFields).toEqual([
    expect.objectContaining({
      fieldKey: "supplier_group",
      dataType: "SELECT",
      isRequired: true,
      options: ["Materials", "Services"],
    }),
  ]);
  const customer = await request.get(
    "/api/v1/mobile/account/master-data/customers?view=options",
    { headers },
  );
  expect(
    (await customer.json()).partyCustomFields.find(
      (f: { fieldKey: string }) => f.fieldKey === "requires_review",
    ),
  ).toMatchObject({ dataType: "BOOLEAN", isRequired: true, options: [] });
});
