import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { expect, test } from "@playwright/test";
import {
  createCommercialDocumentForActor,
  postCommercialDocumentForActor,
} from "../src/lib/account/commercial";
import type { ProjectActor } from "../src/lib/account/projects";
import { DEFAULT_LEDGER_ACCOUNTS } from "../src/lib/accounting/default-accounts";
const db = new PrismaClient(),
  password = randomBytes(24).toString("base64url");
let companyId: string, userId: string, seriesId: string, email: string;
test.setTimeout(90000);
test.beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !url.pathname.endsWith("_ci")
  )
    throw new Error("Browser fixtures require an isolated local *_ci database");
  const company = await db.company.create({
    data: {
      name: "Audit review fixture",
      slug: `review-${randomUUID()}`,
      productEdition: "SALESPUNCH360_ACCOUNT",
      subscriptionStatus: "TRIAL",
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  companyId = company.id;
  const user = await db.user.create({
    data: {
      companyId,
      name: "Review administrator",
      email: `${randomUUID()}@example.test`,
      passwordHash: await hash(password, {
        algorithm: 2,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      }),
      role: "ACCOUNT_USER",
      accountRole: "ACCOUNT_ADMIN",
      accountAccessActive: true,
      emailVerifiedAt: new Date(),
      branchAccessScope: "ALL_BRANCHES",
    },
  });
  email = user.email;
  userId = user.id;
  const branch = await db.branch.create({
    data: { companyId, name: "Review branch", code: "MAIN", isPrimary: true },
  });
  await db.accountSettings.create({ data: { companyId, enabledModules: [] } });
  await db.financialYear.create({
    data: {
      companyId,
      name: "Review FY",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      isCurrent: true,
    },
  });
  for (const row of DEFAULT_LEDGER_ACCOUNTS)
    await db.ledgerAccount.create({
      data: {
        companyId,
        code: row.code,
        name: row.name,
        accountClass: row.accountClass,
        normalBalance: row.normalBalance,
        systemKey: row.systemKey,
        isSystem: row.isSystem,
      },
    });
  const receiptCustomer = await db.customer.create({
    data: {
      companyId,
      branchId: branch.id,
      name: "Review customer",
      isAccountCustomer: true,
    },
  });
  const receiptActor = {
    ...user,
    companyId,
    branchAccessScope: "ALL_BRANCHES",
    branchIds: [],
  } as ProjectActor;
  const invoice = await createCommercialDocumentForActor(receiptActor, {
    type: "SALES_INVOICE",
    branchId: branch.id,
    partyId: receiptCustomer.id,
    issueDate: "2026-11-05",
    lines: [
      {
        lineType: "CUSTOM",
        itemName: "Reference service",
        quantity: "1",
        rate: "593",
        taxRate: "0",
      },
    ],
  });
  await postCommercialDocumentForActor(receiptActor, {
    documentId: invoice.id,
  });
  seriesId = (
    await db.numberingSeries.create({
      data: {
        companyId,
        branchId: branch.id,
        seriesKey: "SALES_INVOICE",
        prefix: "PRIOR/",
        padding: 4,
        nextSequence: BigInt(12),
      },
    })
  ).id;
  await db.accountingAuditEvent.create({
    data: {
      companyId,
      actorUserId: userId,
      eventType: "SETTINGS_CHANGED",
      entityType: "NUMBERING_SERIES",
      entityId: seriesId,
      metadata: { apiKey: "hidden-review-marker", amount: "100" },
    },
  });
});
test.afterAll(async () => {
  await db.$disconnect();
});
test.beforeEach(async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/, { timeout: 45000 });
});
test("audit activity redacts credentials and filters without changing history", async ({
  page,
}) => {
  await page.goto("/workspace/account/utilities/audit");
  await expect(
    page.getByRole("heading", { name: "Audit history", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("hidden-review-marker");
  await expect(page.locator("pre").first()).toContainText("[REDACTED]");
  await expect(page.getByText(/Review administrator ·/).first()).toBeVisible();
});
test("numbering preview is read-only and confirmation restarts only future numbering", async ({
  page,
}) => {
  await page.goto("/workspace/account/utilities/financial-year/numbering");
  const prefix = `REVIEW-${randomUUID().slice(0, 6).toUpperCase()}/`;
  await page.getByLabel("Branch and document series").selectOption(seriesId);
  await page.getByLabel("New prefix", { exact: true }).fill(prefix);
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Reviewed financial-year numbering");
  await page
    .getByRole("button", { name: "Preview numbering restart", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review future numbers" }),
  ).toBeVisible();
  expect(
    (await db.numberingSeries.findUniqueOrThrow({ where: { id: seriesId } }))
      .nextSequence,
  ).toBe(BigInt(12));
  await page
    .getByRole("checkbox", {
      name: "I confirm this restart applies only to future documents.",
    })
    .check();
  await page
    .getByRole("button", { name: "Confirm numbering restart", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Future numbering restarted",
  );
  expect(
    (await db.numberingSeries.findUniqueOrThrow({ where: { id: seriesId } }))
      .nextSequence,
  ).toBe(BigInt(1));
  expect(
    await db.accountingAuditEvent.count({
      where: { companyId, entityId: seriesId, eventType: "SETTINGS_CHANGED" },
    }),
  ).toBe(2);
});
test("close-books review shows company, check scope and blockers without closing", async ({
  page,
}) => {
  await page.goto("/workspace/account/utilities/financial-year");
  await page.getByRole("button", { name: "Review closing Review FY" }).click();
  await expect(page.getByText(/Audit review fixture · Review:/)).toBeVisible();
  await expect(
    page.getByText(
      /Ledger, money-account, project and asset integrity: whole company/,
    ),
  ).toBeVisible();
  expect(
    (await db.financialYear.findFirstOrThrow({ where: { companyId } })).status,
  ).toBe("OPEN");
  expect(await db.accountingPeriodLock.count({ where: { companyId } })).toBe(0);
});
test("reference links show 593 cap and 507 unused with cancel preserving the receipt", async ({
  page,
}, info) => {
  await page.goto(
    "/workspace/account/transactions/money?type=CUSTOMER_RECEIPT",
  );
  await expect(
    page.getByRole("button", { name: "Link", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Customer Name", { exact: true })
    .selectOption({ label: "Review customer" });
  await expect(
    page.getByText("Party Balance: ₹593.00", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Received", { exact: true }).fill("1100");
  await page.getByRole("button", { name: "Link", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Link Payment To Txns" });
  await expect(dialog.getByText(/Original amount:.*593/)).toBeVisible();
  await dialog.getByRole("checkbox").check();
  await dialog.getByLabel("Link Amount").fill("594");
  await expect(
    dialog.getByRole("button", { name: "Done", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Link Amount").fill("593");
  await expect(
    dialog.getByText("Unused Amount: ₹507.00", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.screenshot({
    path: info.outputPath("payment-in-reference.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await dialog.getByLabel("Total Received").fill("1200");
  await dialog.getByLabel("Link Amount").fill("100");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Received", { exact: true })).toHaveValue(
    "1100",
  );
  await expect(
    page.getByText("Unused credit: ₹507.00", { exact: true }),
  ).toBeVisible();
});
test("creating a party preserves the draft and selects its saved identity", async ({
  page,
}) => {
  await page.goto(
    "/workspace/account/transactions/money?type=CUSTOMER_RECEIPT",
  );
  await page.getByLabel("Received", { exact: true }).fill("123.45");
  await page.getByLabel("Description", { exact: true }).fill("Keep this draft");
  await page
    .getByRole("button", { name: "+ Add New Party", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Add New Party",
    exact: true,
  });
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Created receipt party");
  await dialog.getByLabel("Mobile number").fill("9000000001");
  await dialog.getByRole("button", { name: "Save and select" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Billing Name (optional)")).toHaveValue(
    "Created receipt party",
  );
  await expect(page.getByLabel("Received", { exact: true })).toHaveValue(
    "123.45",
  );
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Keep this draft",
  );
  await expect(
    page.getByText("Party Balance: ₹0.00", { exact: true }),
  ).toBeVisible();
});
test("payment billing and private evidence save once and download through scoped authorization", async ({
  page,
}) => {
  await page.goto(
    "/workspace/account/transactions/money?type=CUSTOMER_ADVANCE",
  );
  await page
    .getByLabel("Customer Name", { exact: true })
    .selectOption({ label: "Review customer" });
  await page.getByLabel("Received", { exact: true }).fill("100");
  await page.getByLabel("Billing Name (optional)").fill("Review billing name");
  await page
    .getByLabel("Attachment", { exact: false })
    .setInputFiles({
      name: "receipt.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nbrowser evidence"),
    });
  await page
    .getByRole("button", { name: "+ Add Payment Type", exact: true })
    .click();
  const accountDialog = page.getByRole("dialog", {
    name: "Add Payment Type",
    exact: true,
  });
  await accountDialog
    .getByLabel("Name", { exact: true })
    .fill("Browser receipt cash");
  await accountDialog.getByLabel("Account type").selectOption("CASH");
  await accountDialog.getByRole("button", { name: "Save and select" }).click();
  await expect(accountDialog).not.toBeVisible();
  await expect(page.getByLabel("Received", { exact: true })).toHaveValue("100");
  await expect(page.getByLabel("Billing Name (optional)")).toHaveValue(
    "Review billing name",
  );
  await expect(page.getByLabel("Payment Type", { exact: true })).toHaveValue(
    /.+/,
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account\/settlements\//);
  await expect(
    page.getByText("Review billing name", { exact: true }),
  ).toBeVisible();
  const link = page.getByRole("link", { name: "receipt.pdf", exact: true }),
    href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toContain("attachment");
  expect((await response.body()).toString()).toBe("%PDF-1.7\nbrowser evidence");
  expect(await db.accountSettlement.count({ where: { companyId } })).toBe(1);
  expect(await db.paymentAttachment.count({ where: { companyId } })).toBe(1);
});
