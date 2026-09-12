import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";

const MIGRATION = "20260911240000_a11_a14_runtime_closure";
const prisma = new PrismaClient();
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const SYSTEM_LEDGERS = [
  ["1460", "Inventory Asset", "ASSET", "DEBIT", "INVENTORY_ASSET"],
  ["1470", "CGST ITC", "ASSET", "DEBIT", "CGST_ITC"],
  ["1471", "SGST ITC", "ASSET", "DEBIT", "SGST_ITC"],
  ["1472", "IGST ITC", "ASSET", "DEBIT", "IGST_ITC"],
  ["1473", "CESS ITC", "ASSET", "DEBIT", "CESS_ITC"],
  ["2110", "CGST Payable", "LIABILITY", "CREDIT", "CGST_PAYABLE"],
  ["2111", "SGST Payable", "LIABILITY", "CREDIT", "SGST_PAYABLE"],
  ["2112", "IGST Payable", "LIABILITY", "CREDIT", "IGST_PAYABLE"],
  ["2113", "CESS Payable", "LIABILITY", "CREDIT", "CESS_PAYABLE"],
  ["2120", "TDS Payable", "LIABILITY", "CREDIT", "TDS_PAYABLE"],
  ["2130", "TCS Payable", "LIABILITY", "CREDIT", "TCS_PAYABLE"],
  ["5200", "Cost of Goods Sold", "EXPENSE", "DEBIT", "COGS"],
];

async function failedMigrationExists() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM "_prisma_migrations"
      WHERE "migration_name" = $1
        AND "finished_at" IS NULL
        AND "rolled_back_at" IS NULL
      LIMIT 1`,
    MIGRATION,
  );
  return rows.length > 0;
}

async function constraintExists(table, name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM pg_constraint
      WHERE conname = $1
        AND conrelid = to_regclass($2)
      LIMIT 1`,
    name,
    `public.${table}`,
  );
  return rows.length > 0;
}

async function ensureConstraint(table, name, sql) {
  if (!(await constraintExists(table, name))) {
    await prisma.$executeRawUnsafe(sql);
  }
}

async function ensureSystemLedgers() {
  const companies = await prisma.$queryRawUnsafe(
    `SELECT "id" FROM "companies"
      WHERE "productEdition" IN ('SALESPUNCH360_ACCOUNT','SALESPUNCH360_PLUS')`,
  );
  for (const company of companies) {
    const existing = await prisma.$queryRawUnsafe(
      `SELECT "code","name","systemKey" FROM "ledger_accounts"
        WHERE "companyId"=$1::uuid`,
      company.id,
    );
    const codes = new Set(existing.map((row) => row.code));
    const names = new Set(existing.map((row) => row.name));
    const keys = new Set(existing.map((row) => row.systemKey).filter(Boolean));
    for (const [preferredCode, preferredName, accountClass, normal, key] of SYSTEM_LEDGERS) {
      if (keys.has(key)) continue;
      let code = preferredCode;
      for (let suffix = 1; codes.has(code); suffix += 1) code = `SYS${preferredCode}-${suffix}`;
      let name = preferredName;
      for (let suffix = 1; names.has(name); suffix += 1) name = `${preferredName} (System${suffix === 1 ? "" : ` ${suffix}`})`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ledger_accounts"
          ("id","companyId","code","name","accountClass","normalBalance","systemKey","isSystem","isActive","allowPosting","createdAt","updatedAt")
         VALUES (gen_random_uuid(),$1::uuid,$2,$3,$4::"LedgerAccountClass",$5::"NormalBalanceSide",$6,true,true,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("companyId","systemKey") DO NOTHING`,
        company.id,
        code,
        name,
        accountClass,
        normal,
        key,
      );
      codes.add(code);
      names.add(name);
      keys.add(key);
    }
  }
}

async function repair() {
  if (!(await failedMigrationExists())) {
    await prisma.$disconnect();
    return;
  }

  console.log(`Detected failed ${MIGRATION}; completing the migration safely before resolve.`);

  await prisma.$executeRawUnsafe(`ALTER TYPE "PurchaseClassification" ADD VALUE IF NOT EXISTS 'FIXED_ASSET'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "commercial_document_lines"
    ADD COLUMN IF NOT EXISTS "warehouseId" UUID,
    ADD COLUMN IF NOT EXISTS "batchId" UUID,
    ADD COLUMN IF NOT EXISTS "serialNumberId" UUID,
    ADD COLUMN IF NOT EXISTS "stockReturnQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "cessRate" DECIMAL(7,4) NOT NULL DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "expense_transactions"
    ADD COLUMN IF NOT EXISTS "stateOfSupplyCode" VARCHAR(2),
    ADD COLUMN IF NOT EXISTS "taxMode" "TaxMode" NOT NULL DEFAULT 'EXCLUSIVE',
    ADD COLUMN IF NOT EXISTS "cessRate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "cgstAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "sgstAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "igstAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "cessAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "taxCreditTreatment" "TaxCreditTreatment" NOT NULL DEFAULT 'ELIGIBLE'`);

  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "commercial_document_lines_companyId_id_key" ON "commercial_document_lines"("companyId","id")`);

  const constraints = [
    ["commercial_document_lines", "commercial_line_stock_return_valid", `ALTER TABLE "commercial_document_lines" ADD CONSTRAINT "commercial_line_stock_return_valid" CHECK ("stockReturnQuantity" >= 0 AND "stockReturnQuantity" <= "quantity")`],
    ["commercial_document_lines", "commercial_line_warehouse_company_fk", `ALTER TABLE "commercial_document_lines" ADD CONSTRAINT "commercial_line_warehouse_company_fk" FOREIGN KEY ("companyId","warehouseId") REFERENCES "warehouses"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["commercial_document_lines", "commercial_line_batch_company_fk", `ALTER TABLE "commercial_document_lines" ADD CONSTRAINT "commercial_line_batch_company_fk" FOREIGN KEY ("companyId","batchId") REFERENCES "inventory_batches"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["commercial_document_lines", "commercial_line_serial_company_fk", `ALTER TABLE "commercial_document_lines" ADD CONSTRAINT "commercial_line_serial_company_fk" FOREIGN KEY ("companyId","serialNumberId") REFERENCES "inventory_serial_numbers"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["inventory_batches", "inventory_batches_company_fk", `ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["inventory_serial_numbers", "inventory_serial_company_fk", `ALTER TABLE "inventory_serial_numbers" ADD CONSTRAINT "inventory_serial_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["stock_movements", "stock_movements_batch_fk", `ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_fk" FOREIGN KEY ("companyId","batchId") REFERENCES "inventory_batches"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["stock_movements", "stock_movements_serial_fk", `ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_serial_fk" FOREIGN KEY ("companyId","serialNumberId") REFERENCES "inventory_serial_numbers"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["stock_movements", "stock_movements_creator_fk", `ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_creator_fk" FOREIGN KEY ("companyId","createdById") REFERENCES "users"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["product_prices", "product_prices_customer_fk", `ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_customer_fk" FOREIGN KEY ("companyId","customerId") REFERENCES "customers"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["assets", "assets_purchase_document_fk", `ALTER TABLE "assets" ADD CONSTRAINT "assets_purchase_document_fk" FOREIGN KEY ("companyId","purchaseDocumentId") REFERENCES "commercial_documents"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["assets", "assets_purchase_line_fk", `ALTER TABLE "assets" ADD CONSTRAINT "assets_purchase_line_fk" FOREIGN KEY ("companyId","purchaseDocumentLineId") REFERENCES "commercial_document_lines"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["assets", "assets_assignee_fk", `ALTER TABLE "assets" ADD CONSTRAINT "assets_assignee_fk" FOREIGN KEY ("companyId","assignedUserId") REFERENCES "users"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["assets", "assets_creator_fk", `ALTER TABLE "assets" ADD CONSTRAINT "assets_creator_fk" FOREIGN KEY ("companyId","createdById") REFERENCES "users"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["assets", "assets_asset_ledger_fk", `ALTER TABLE "assets" ADD CONSTRAINT "assets_asset_ledger_fk" FOREIGN KEY ("companyId","assetLedgerId") REFERENCES "ledger_accounts"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["assets", "assets_accumulated_ledger_fk", `ALTER TABLE "assets" ADD CONSTRAINT "assets_accumulated_ledger_fk" FOREIGN KEY ("companyId","accumulatedDepreciationLedgerId") REFERENCES "ledger_accounts"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["assets", "assets_depreciation_expense_ledger_fk", `ALTER TABLE "assets" ADD CONSTRAINT "assets_depreciation_expense_ledger_fk" FOREIGN KEY ("companyId","depreciationExpenseLedgerId") REFERENCES "ledger_accounts"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["asset_assignment_history", "asset_assignment_user_fk", `ALTER TABLE "asset_assignment_history" ADD CONSTRAINT "asset_assignment_user_fk" FOREIGN KEY ("companyId","assignedToId") REFERENCES "users"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
    ["asset_assignment_history", "asset_assignment_actor_fk", `ALTER TABLE "asset_assignment_history" ADD CONSTRAINT "asset_assignment_actor_fk" FOREIGN KEY ("companyId","assignedById") REFERENCES "users"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT`],
  ];
  for (const [table, name, sql] of constraints) await ensureConstraint(table, name, sql);

  const indexes = [
    `CREATE INDEX IF NOT EXISTS "inventory_batches_expiry_idx" ON "inventory_batches"("companyId","expiryDate")`,
    `CREATE INDEX IF NOT EXISTS "inventory_serial_expiry_idx" ON "inventory_serial_numbers"("companyId","expiryDate")`,
    `CREATE INDEX IF NOT EXISTS "stock_movements_serial_state_idx" ON "stock_movements"("companyId","serialNumberId","movementDate")`,
    `CREATE INDEX IF NOT EXISTS "commercial_lines_warehouse_product_idx" ON "commercial_document_lines"("companyId","warehouseId","productId")`,
    `CREATE INDEX IF NOT EXISTS "assets_purchase_document_idx" ON "assets"("companyId","purchaseDocumentId")`,
    `CREATE INDEX IF NOT EXISTS "assets_assignee_idx" ON "assets"("companyId","assignedUserId")`,
  ];
  for (const sql of indexes) await prisma.$executeRawUnsafe(sql);

  await ensureSystemLedgers();

  for (const [table, name] of constraints) {
    if (!(await constraintExists(table, name))) throw new Error(`Repair incomplete: ${name} is missing.`);
  }

  await prisma.$disconnect();
  const result = spawnSync(npx, ["prisma", "migrate", "resolve", "--applied", MIGRATION], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) throw new Error(`Failed to resolve ${MIGRATION} as applied.`);
}

repair().catch(async (error) => {
  console.error("A11-A14 migration repair failed:", error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
