-- Pending cheques do not post journals or settle invoices. Legacy records retain their data.
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'PENDING_CHEQUE';
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'REVERSED';
ALTER TABLE "account_settlements" ALTER COLUMN "journalEntryId" DROP NOT NULL;
ALTER TABLE "account_settlements" ADD COLUMN "creationRequestHash" VARCHAR(64), ADD COLUMN "chequeId" UUID;
ALTER TABLE "cheques" ADD COLUMN "amount" DECIMAL(18,2), ADD COLUMN "settlementId" UUID, ADD COLUMN "actionVersion" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "cheques_companyId_settlementId_key" ON "cheques"("companyId","settlementId");
ALTER TABLE "cheques" ADD CONSTRAINT "cheque_settlement_company_fkey" FOREIGN KEY ("companyId","settlementId") REFERENCES "account_settlements"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "account_settlements" ADD CONSTRAINT "settlement_cheque_company_fkey" FOREIGN KEY ("companyId","chequeId") REFERENCES "cheques"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "cheques" ADD CONSTRAINT "cheque_amount_positive" CHECK ("amount" IS NULL OR "amount">0);
ALTER TABLE "cheques" ADD CONSTRAINT "cheque_version_nonnegative" CHECK ("actionVersion">=0);
-- Do not loosen posted financial history. Only bounded lifecycle transitions are allowed.
CREATE OR REPLACE FUNCTION guard_settlement_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."status"::text='PENDING_CHEQUE' AND current_setting('app.financial_write_company_id',true)=OLD."companyId"::text THEN
  IF NEW."status"::text='PENDING_CHEQUE' AND to_jsonb(NEW)-'chequeId'=to_jsonb(OLD)-'chequeId' THEN RETURN NEW; END IF;
  IF NEW."status"::text='POSTED' AND NEW."journalEntryId" IS NOT NULL
   AND to_jsonb(NEW)-ARRAY['status','journalEntryId','transactionDate','remainingAmount','moneyAccountId']=to_jsonb(OLD)-ARRAY['status','journalEntryId','transactionDate','remainingAmount','moneyAccountId']
   AND EXISTS(SELECT 1 FROM "journal_entries" j WHERE j."companyId"=OLD."companyId" AND j."id"=NEW."journalEntryId" AND j."status"::text='POSTED' AND j."sourceId"=OLD."id"::text AND j."entryDate"=NEW."transactionDate") THEN RETURN NEW; END IF;
 END IF;
 IF NEW."status"=OLD."status" AND NEW."remainingAmount"<=OLD."remainingAmount"
  AND to_jsonb(NEW)-'remainingAmount'=to_jsonb(OLD)-'remainingAmount' THEN RETURN NEW; END IF;
 IF OLD."status"::text='POSTED' AND NEW."status"::text='REVERSED' AND NEW."remainingAmount"=0
  AND current_setting('app.financial_reversal_company_id',true)=OLD."companyId"::text
  AND to_jsonb(NEW)-ARRAY['status','remainingAmount']=to_jsonb(OLD)-ARRAY['status','remainingAmount']
  AND EXISTS(SELECT 1 FROM "journal_entries" j JOIN "journal_entries" r ON r."companyId"=j."companyId" AND r."reversalOfId"=j."id" AND r."status"::text='POSTED' WHERE j."companyId"=OLD."companyId" AND j."id"=OLD."journalEntryId" AND j."status"::text='REVERSED') THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'FINANCIAL_HISTORY_IMMUTABLE';
END $$;
