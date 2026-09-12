import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";

const TARGET_MIGRATION = "20260911190000_a10_runtime_integrity";
const ACCOUNT_RUNTIME_MIGRATION = "20260911240000_a11_a14_runtime_closure";
const ACCOUNT_SYSTEM_LEDGERS = [
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
const prisma = new PrismaClient();
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function runPrisma(args) {
  const result = spawnSync(npx, ["prisma", ...args], {
    stdio: "inherit",
    env: process.env,
  });
  return result.status === 0;
}

function resolveMigration(mode) {
  const flag = mode === "applied" ? "--applied" : "--rolled-back";
  const result = spawnSync(
    npx,
    ["prisma", "migrate", "resolve", flag, TARGET_MIGRATION],
    { stdio: "inherit", env: process.env },
  );
  if (result.status !== 0) {
    throw new Error(`Failed to mark ${TARGET_MIGRATION} as ${mode}.`);
  }
}

async function hasFailedTargetMigration() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "id"
       FROM "_prisma_migrations"
      WHERE "migration_name" = '${TARGET_MIGRATION}'
        AND "finished_at" IS NULL
        AND "rolled_back_at" IS NULL
      ORDER BY "started_at" DESC
      LIMIT 1`,
  );
  return rows.length > 0;
}

async function ownerTransactionsTableExists() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public.owner_transactions') IS NOT NULL AS "exists"`,
  );
  return rows[0]?.exists === true;
}

async function repairA10RuntimeMigration() {
  if (!(await hasFailedTargetMigration())) return false;

  console.log(
    `Detected failed ${TARGET_MIGRATION}; applying one-time compatibility repair.`,
  );

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "owner_financial_accounts_companyId_id_key"
       ON "owner_financial_accounts"("companyId", "id")`,
  );

  const partial = await ownerTransactionsTableExists();

  if (!partial) {
    await prisma.$disconnect();
    resolveMigration("rolled-back");
    return true;
  }

  await prisma.$executeRawUnsafe(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'owner_transaction_owner_company_fkey'
  ) THEN
    ALTER TABLE "owner_transactions"
      ADD CONSTRAINT "owner_transaction_owner_company_fkey"
      FOREIGN KEY ("companyId","ownerFinancialAccountId")
      REFERENCES "owner_financial_accounts"("companyId","id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'owner_transaction_money_company_fkey'
  ) THEN
    ALTER TABLE "owner_transactions"
      ADD CONSTRAINT "owner_transaction_money_company_fkey"
      FOREIGN KEY ("companyId","moneyAccountId")
      REFERENCES "money_accounts"("companyId","id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'owner_transaction_journal_company_fkey'
  ) THEN
    ALTER TABLE "owner_transactions"
      ADD CONSTRAINT "owner_transaction_journal_company_fkey"
      FOREIGN KEY ("companyId","journalEntryId")
      REFERENCES "journal_entries"("companyId","id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'owner_transaction_creator_company_fkey'
  ) THEN
    ALTER TABLE "owner_transactions"
      ADD CONSTRAINT "owner_transaction_creator_company_fkey"
      FOREIGN KEY ("companyId","createdById")
      REFERENCES "users"("companyId","id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;
`);

  await prisma.$disconnect();
  resolveMigration("applied");
  return true;
}

async function preseedAccountSystemLedgers() {
  const tables = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public.ledger_accounts') IS NOT NULL AS "ledgers",
            to_regclass('public.companies') IS NOT NULL AS "companies",
            to_regclass('public._prisma_migrations') IS NOT NULL AS "migrations"`,
  );
  if (!tables[0]?.ledgers || !tables[0]?.companies || !tables[0]?.migrations)
    return;
  const applied = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM "_prisma_migrations" WHERE "migration_name"=$1 AND "finished_at" IS NOT NULL LIMIT 1`,
    ACCOUNT_RUNTIME_MIGRATION,
  );
  if (applied.length) return;
  const companies = await prisma.$queryRawUnsafe(
    `SELECT "id" FROM "companies" WHERE "productEdition" IN ('SALESPUNCH360_ACCOUNT','SALESPUNCH360_PLUS')`,
  );
  for (const company of companies) {
    const existing = await prisma.$queryRawUnsafe(
      `SELECT "code","name","systemKey" FROM "ledger_accounts" WHERE "companyId"=$1::uuid`,
      company.id,
    );
    const codes = new Set(existing.map((row) => row.code));
    const names = new Set(existing.map((row) => row.name));
    const keys = new Set(existing.map((row) => row.systemKey).filter(Boolean));
    for (const [preferredCode, preferredName, accountClass, normal, key] of
      ACCOUNT_SYSTEM_LEDGERS) {
      if (keys.has(key)) continue;
      let code = preferredCode;
      for (let suffix = 1; codes.has(code); suffix += 1)
        code = `SYS${preferredCode}-${suffix}`;
      let name = preferredName;
      for (let suffix = 1; names.has(name); suffix += 1)
        name = `${preferredName} (System${suffix === 1 ? "" : ` ${suffix}`})`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ledger_accounts" ("id","companyId","code","name","accountClass","normalBalance","systemKey","isSystem","isActive","allowPosting","createdAt","updatedAt") VALUES (gen_random_uuid(),$1::uuid,$2,$3,$4::"LedgerAccountClass",$5::"NormalBalanceSide",$6,true,true,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("companyId","systemKey") DO NOTHING`,
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await preseedAccountSystemLedgers();
    if (runPrisma(["migrate", "deploy"])) {
      await prisma.$disconnect();
      return;
    }

    try {
      const repaired = await repairA10RuntimeMigration();
      if (repaired && runPrisma(["migrate", "deploy"])) {
        return;
      }
    } catch (error) {
      console.error("Migration repair failed:", error);
      await prisma.$disconnect().catch(() => undefined);
      process.exitCode = 1;
      return;
    }

    if (attempt < 4) {
      console.log(`Migration deploy attempt ${attempt} failed; retrying in 8s...`);
      await sleep(8000);
    }
  }

  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
}

void main();
