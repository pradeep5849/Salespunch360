BEGIN;
-- CreateEnum
CREATE TYPE "LedgerAccountClass" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "NormalBalanceSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountingAuditEventType" AS ENUM ('SYSTEM_ACCOUNTS_INITIALIZED', 'JOURNAL_CREATED', 'JOURNAL_POSTED', 'JOURNAL_REVERSED', 'OPENING_BALANCE_POSTED', 'PERIOD_LOCKED', 'PERIOD_UNLOCKED');

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "accountClass" "LedgerAccountClass" NOT NULL,
    "normalBalance" "NormalBalanceSide" NOT NULL,
    "parentId" UUID,
    "systemKey" VARCHAR(60),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowPosting" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centres" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "financialYearId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "journalNumber" VARCHAR(100) NOT NULL,
    "entryDate" DATE NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "reference" VARCHAR(160),
    "narration" TEXT,
    "sourceType" VARCHAR(60) NOT NULL,
    "sourceId" VARCHAR(100) NOT NULL,
    "postingPurpose" VARCHAR(60) NOT NULL DEFAULT 'PRIMARY',
    "reversalOfId" UUID,
    "reversalReason" TEXT,
    "createdById" UUID NOT NULL,
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "journalEntryId" UUID NOT NULL,
    "ledgerAccountId" UUID NOT NULL,
    "costCentreId" UUID,
    "lineNumber" INTEGER NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_period_locks" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "financialYearId" UUID NOT NULL,
    "lockedThrough" DATE,
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_period_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_audit_events" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "eventType" "AccountingAuditEventType" NOT NULL,
    "entityType" VARCHAR(60) NOT NULL,
    "entityId" VARCHAR(100) NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_accounts_companyId_accountClass_isActive_idx" ON "ledger_accounts"("companyId", "accountClass", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_companyId_id_key" ON "ledger_accounts"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_companyId_code_key" ON "ledger_accounts"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_companyId_name_key" ON "ledger_accounts"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_companyId_systemKey_key" ON "ledger_accounts"("companyId", "systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centres_companyId_id_key" ON "cost_centres"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centres_companyId_code_key" ON "cost_centres"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centres_companyId_name_key" ON "cost_centres"("companyId", "name");

-- CreateIndex
CREATE INDEX "journal_entries_companyId_entryDate_status_idx" ON "journal_entries"("companyId", "entryDate", "status");

-- CreateIndex
CREATE INDEX "journal_entries_companyId_branchId_entryDate_idx" ON "journal_entries"("companyId", "branchId", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_companyId_id_key" ON "journal_entries"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_companyId_journalNumber_key" ON "journal_entries"("companyId", "journalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_companyId_sourceType_sourceId_postingPurpos_key" ON "journal_entries"("companyId", "sourceType", "sourceId", "postingPurpose");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_companyId_reversalOfId_key" ON "journal_entries"("companyId", "reversalOfId");

-- CreateIndex
CREATE INDEX "journal_lines_companyId_ledgerAccountId_idx" ON "journal_lines"("companyId", "ledgerAccountId");

-- CreateIndex
CREATE INDEX "journal_lines_companyId_costCentreId_idx" ON "journal_lines"("companyId", "costCentreId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_lines_journalEntryId_lineNumber_key" ON "journal_lines"("journalEntryId", "lineNumber");

-- CreateIndex
CREATE INDEX "accounting_period_locks_companyId_lockedThrough_idx" ON "accounting_period_locks"("companyId", "lockedThrough");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_period_locks_companyId_id_key" ON "accounting_period_locks"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_period_locks_companyId_financialYearId_key" ON "accounting_period_locks"("companyId", "financialYearId");

-- CreateIndex
CREATE INDEX "accounting_audit_events_companyId_createdAt_idx" ON "accounting_audit_events"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "accounting_audit_events_companyId_entityType_entityId_idx" ON "accounting_audit_events"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_years_companyId_id_key" ON "financial_years"("companyId", "id");

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_companyId_parentId_fkey" FOREIGN KEY ("companyId", "parentId") REFERENCES "ledger_accounts"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "cost_centres" ADD CONSTRAINT "cost_centres_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_companyId_financialYearId_fkey" FOREIGN KEY ("companyId", "financialYearId") REFERENCES "financial_years"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_companyId_branchId_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_companyId_reversalOfId_fkey" FOREIGN KEY ("companyId", "reversalOfId") REFERENCES "journal_entries"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_companyId_journalEntryId_fkey" FOREIGN KEY ("companyId", "journalEntryId") REFERENCES "journal_entries"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_companyId_ledgerAccountId_fkey" FOREIGN KEY ("companyId", "ledgerAccountId") REFERENCES "ledger_accounts"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_companyId_costCentreId_fkey" FOREIGN KEY ("companyId", "costCentreId") REFERENCES "cost_centres"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "accounting_period_locks" ADD CONSTRAINT "accounting_period_locks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "accounting_period_locks" ADD CONSTRAINT "accounting_period_locks_companyId_financialYearId_fkey" FOREIGN KEY ("companyId", "financialYearId") REFERENCES "financial_years"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "accounting_audit_events" ADD CONSTRAINT "accounting_audit_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "accounting_audit_events" ADD CONSTRAINT "accounting_audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_line_one_side_positive" CHECK ("debit" >= 0 AND "credit" >= 0 AND (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)));
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_posting_fields" CHECK (("status" = 'DRAFT') OR ("postedAt" IS NOT NULL AND "postedById" IS NOT NULL));
INSERT INTO "ledger_accounts" ("id","companyId","code","name","accountClass","normalBalance","systemKey","isSystem","isActive","allowPosting","createdAt","updatedAt")
SELECT gen_random_uuid(), c.id, v.code, v.name, v.class::"LedgerAccountClass", v.normal::"NormalBalanceSide", v.key, true, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c CROSS JOIN (VALUES
('1000','Cash','ASSET','DEBIT','CASH'),('1100','Bank','ASSET','DEBIT','BANK'),('1200','Accounts Receivable','ASSET','DEBIT','ACCOUNTS_RECEIVABLE'),('1300','Inventory','ASSET','DEBIT','INVENTORY'),('1400','Advances','ASSET','DEBIT','ADVANCES'),('1500','Fixed Assets','ASSET','DEBIT','FIXED_ASSETS'),('2000','Accounts Payable','LIABILITY','CREDIT','ACCOUNTS_PAYABLE'),('2100','Taxes Payable','LIABILITY','CREDIT','TAXES_PAYABLE'),('2200','Loans','LIABILITY','CREDIT','LOANS'),('3000','Owner Capital','EQUITY','CREDIT','OWNER_CAPITAL'),('3100','Drawings','EQUITY','DEBIT','DRAWINGS'),('3200','Retained Earnings','EQUITY','CREDIT','RETAINED_EARNINGS'),('3300','Opening Balance Equity','EQUITY','CREDIT','OPENING_BALANCE_EQUITY'),('4000','Sales / Service Income','INCOME','CREDIT','SALES_INCOME'),('4100','Other Income','INCOME','CREDIT','OTHER_INCOME'),('5000','Purchase / Cost','EXPENSE','DEBIT','PURCHASE_COST'),('5100','General Expenses','EXPENSE','DEBIT','GENERAL_EXPENSES')) v(code,name,class,normal,key)
WHERE c."productEdition" IN ('SALESPUNCH360_ACCOUNT','SALESPUNCH360_PLUS') ON CONFLICT ("companyId","systemKey") DO NOTHING;

CREATE FUNCTION protect_posted_journal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF current_setting('app.account_cleanup_company_id', true) = OLD."companyId"::text THEN RETURN NEW; END IF;
 IF OLD."status" IN ('POSTED','REVERSED') AND NOT (OLD."status"='POSTED' AND NEW."status"='REVERSED' AND NEW."reversalOfId" IS NOT DISTINCT FROM OLD."reversalOfId") THEN RAISE EXCEPTION 'posted journal is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER journal_entry_immutable BEFORE UPDATE ON "journal_entries" FOR EACH ROW EXECUTE FUNCTION protect_posted_journal();
CREATE FUNCTION protect_posted_journal_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF current_setting('app.account_cleanup_company_id', true) = OLD."companyId"::text THEN RETURN OLD; END IF; IF OLD."status" IN ('POSTED','REVERSED') THEN RAISE EXCEPTION 'posted journal cannot be deleted'; END IF; RETURN OLD; END $$;
CREATE TRIGGER journal_entry_no_delete BEFORE DELETE ON "journal_entries" FOR EACH ROW EXECUTE FUNCTION protect_posted_journal_delete();
CREATE FUNCTION protect_posted_lines() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF current_setting('app.account_cleanup_company_id', true) = OLD."companyId"::text THEN RETURN OLD; END IF; IF EXISTS (SELECT 1 FROM "journal_entries" j WHERE j.id=OLD."journalEntryId" AND j."status" IN ('POSTED','REVERSED')) THEN RAISE EXCEPTION 'posted journal lines are immutable'; END IF; RETURN OLD; END $$;
CREATE TRIGGER journal_line_no_update BEFORE UPDATE OR DELETE ON "journal_lines" FOR EACH ROW EXECUTE FUNCTION protect_posted_lines();
CREATE FUNCTION protect_accounting_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF current_setting('app.account_cleanup_company_id', true) = OLD."companyId"::text THEN RETURN OLD; END IF; RAISE EXCEPTION 'accounting audit is append-only'; END $$;
CREATE TRIGGER accounting_audit_append_only BEFORE UPDATE OR DELETE ON "accounting_audit_events" FOR EACH ROW EXECUTE FUNCTION protect_accounting_audit();
COMMIT;
