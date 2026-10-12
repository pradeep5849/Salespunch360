-- Preserve legacy WITHDRAWAL semantics; do not reclassify historical transactions.
ALTER TYPE "OwnerTransactionType" ADD VALUE IF NOT EXISTS 'CAPITAL_WITHDRAWAL';
ALTER TYPE "OwnerTransactionType" ADD VALUE IF NOT EXISTS 'PROFIT_DISTRIBUTION';
CREATE TYPE "OwnerPartyType" AS ENUM ('OWNER', 'PARTNER');
ALTER TABLE "owner_financial_accounts"
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN "legacyUserId" UUID,
  ADD COLUMN "name" VARCHAR(160) NOT NULL DEFAULT 'Owner',
  ADD COLUMN "partyType" "OwnerPartyType" NOT NULL DEFAULT 'OWNER',
  ADD COLUMN "phone" VARCHAR(40),
  ADD COLUMN "email" VARCHAR(320),
  ADD COLUMN "address" VARCHAR(2000),
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "creationRequestKey" UUID,
  ADD COLUMN "creationInputHash" VARCHAR(64);
-- Use the linked company user's name; retain ledger-derived identity when the user is gone.
UPDATE "owner_financial_accounts" AS o
SET "name" = LEFT(COALESCE(
  (SELECT NULLIF(BTRIM(u."name"), '') FROM "users" u WHERE u."id"=o."userId" AND u."companyId"=o."companyId"),
  (SELECT NULLIF(REGEXP_REPLACE(l."name", ' Capital$', ''), '') FROM "ledger_accounts" l WHERE l."id"=o."capitalLedgerId" AND l."companyId"=o."companyId"),
  'Owner'),160);
-- A missing user link must not remove the owner or financial history; retain its historical ID.
UPDATE "owner_financial_accounts" AS o SET "legacyUserId"=o."userId", "userId"=NULL
WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id"=o."userId" AND u."companyId"=o."companyId");
CREATE UNIQUE INDEX "owner_financial_accounts_companyId_creationRequestKey_key" ON "owner_financial_accounts"("companyId","creationRequestKey");
CREATE INDEX "owner_financial_accounts_companyId_isActive_name_idx" ON "owner_financial_accounts"("companyId","isActive","name");
