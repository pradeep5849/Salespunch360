import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";

const TARGET_MIGRATION = "20260911190000_a10_runtime_integrity";
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
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
