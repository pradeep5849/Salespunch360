import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { db } from "@/lib/db";
import {
  createCommercialDocumentForActor,
  postCommercialDocumentForActor,
} from "@/lib/account/commercial";
import { stockValuation } from "@/lib/account/inventory-policy";
test("real PostgreSQL sales save and post with GST and negative inventory", async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.hostname !== "127.0.0.1" || !url.pathname.endsWith("_ci"))
    throw new Error(
      "Sales regression requires an isolated loopback *_ci database",
    );
  const nonce = randomUUID();
  const company = await db.company.create({
    data: {
      name: `Invoice smoke ${nonce}`,
      slug: `invoice-smoke-${nonce}`,
      productEdition: "SALESPUNCH360_ACCOUNT",
    },
  });
  const branch = await db.branch.create({
    data: {
      companyId: company.id,
      name: "Smoke branch",
      code: "PRIMARY",
      gstStateCode: "29",
    },
  });
  const user = await db.user.create({
    data: {
      companyId: company.id,
      name: "Local smoke",
      email: `${nonce}@example.test`,
      passwordHash: "disabled-local-smoke-login",
      role: "ACCOUNT_USER",
      accountRole: "ACCOUNT_ADMIN",
    },
  });
  const customer = await db.customer.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      name: "Smoke customer",
      isAccountCustomer: true,
    },
  });
  const warehouse = await db.warehouse.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      name: "Smoke default",
      code: "DEFAULT",
      isDefault: true,
    },
  });
  await db.accountSettings.create({
    data: { companyId: company.id, negativeStockAllowed: false },
  });
  await db.financialYear.create({
    data: {
      companyId: company.id,
      name: "2026-27",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
    },
  });
  const keys = [
    "ACCOUNTS_RECEIVABLE",
    "SALES_INCOME",
    "CGST_PAYABLE",
    "SGST_PAYABLE",
    "IGST_PAYABLE",
    "CESS_PAYABLE",
    "CGST_ITC",
    "SGST_ITC",
    "IGST_ITC",
    "CESS_ITC",
    "TDS_PAYABLE",
    "TCS_PAYABLE",
    "INVENTORY_ASSET",
    "COGS",
  ];
  for (const [i, key] of keys.entries())
    await db.ledgerAccount.create({
      data: {
        companyId: company.id,
        code: `SMOKE${i}`,
        name: key,
        systemKey: key,
        isSystem: true,
        accountClass:
          key === "SALES_INCOME"
            ? "INCOME"
            : key === "COGS"
              ? "EXPENSE"
              : key.endsWith("PAYABLE")
                ? "LIABILITY"
                : "ASSET",
        normalBalance:
          key === "SALES_INCOME" || key.endsWith("PAYABLE")
            ? "CREDIT"
            : "DEBIT",
      },
    });
  const actor = {
    id: user.id,
    companyId: company.id,
    accountRole: "ACCOUNT_ADMIN",
    branchAccessScope: "ALL_BRANCHES",
    branchIds: [],
  } as never;
  for (const [stock, qty, expected] of [
    [10, 3, 7],
    [0, 1, -1],
    [-2, 3, -5],
  ]) {
    const product = await db.accountProduct.create({
      data: {
        companyId: company.id,
        name: `Stock ${stock}`,
        trackInventory: true,
        salePrice: 100,
        taxRate: 18,
      },
    });
    if (stock !== 0)
      await db.stockMovement.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          warehouseId: warehouse.id,
          productId: product.id,
          movementType: stock > 0 ? "OPENING" : "ADJUSTMENT_OUT",
          quantity: Math.abs(stock),
          unitCost: 10,
          totalCost: Math.abs(stock) * 10,
          sourceType: "LOCAL_SMOKE",
          sourceId: randomUUID(),
          movementDate: new Date("2026-10-01"),
          createdById: user.id,
        },
      });
    const doc = await createCommercialDocumentForActor(actor, {
      type: "SALES_INVOICE",
      branchId: branch.id,
      partyId: customer.id,
      issueDate: "2026-10-07",
      stateOfSupplyCode: "29",
      lines: [
        {
          lineType: "PRODUCT",
          sourceId: product.id,
          quantity: String(qty),
          rate: "100",
          taxRate: "18",
        },
      ],
    });
    if (doc.stateOfSupplyCode !== "29")
      throw new Error("GST state snapshot mismatch");
    await postCommercialDocumentForActor(actor, { documentId: doc.id });
    const rows = await db.stockMovement.findMany({
      where: { companyId: company.id, productId: product.id },
      orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }],
    });
    const final = stockValuation(rows).quantity.toNumber();
    if (final !== expected) throw new Error(`Incorrect stock ${final}`);
    console.info(
      `Real PostgreSQL GST invoice saved and posted: ${stock} - ${qty} = ${final}`,
    );
  }

  const service = await db.accountService.create({
    data: {
      companyId: company.id,
      name: "Non-GST service",
      sellingRate: 50,
      taxRate: 0,
    },
  });
  const nonGst = await createCommercialDocumentForActor(actor, {
    type: "SALES_INVOICE",
    branchId: branch.id,
    partyId: customer.id,
    issueDate: "2026-10-07",
    lines: [
      {
        lineType: "SERVICE",
        sourceId: service.id,
        quantity: "1",
        rate: "50",
        taxRate: "0",
      },
    ],
  });
  expect(nonGst.stateOfSupplyCode).toBeNull();
  expect(nonGst.taxTotal.toString()).toBe("0");
  expect(nonGst.grandTotal.toString()).toBe("50");
  const persisted = await db.commercialDocumentLine.findMany({
    where: { companyId: company.id, documentId: nonGst.id },
  });
  expect(persisted).toHaveLength(1);
  expect(persisted[0].companyId).toBe(company.id);
});
// Fixtures use unique tenants in a disposable CI database; posted records are retained
// rather than bypassing immutable accounting protections during teardown.
test.afterAll(async () => {
  await db.$disconnect();
});
