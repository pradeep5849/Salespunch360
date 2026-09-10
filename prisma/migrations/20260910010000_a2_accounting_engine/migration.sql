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
CREATE UNIQUE INDEX "users_companyId_id_accounting_key" ON "users"("companyId", "id");
CREATE UNIQUE INDEX "journal_entries_companyId_branchId_journalNumber_key" ON "journal_entries"("companyId", "branchId", "journalNumber");
CREATE INDEX "journal_entries_companyId_journalNumber_idx" ON "journal_entries"("companyId", "journalNumber");

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
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_companyId_createdById_fkey" FOREIGN KEY ("companyId", "createdById") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_companyId_postedById_fkey" FOREIGN KEY ("companyId", "postedById") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

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

ALTER TABLE "accounting_period_locks" ADD CONSTRAINT "accounting_period_locks_companyId_updatedById_fkey" FOREIGN KEY ("companyId", "updatedById") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "accounting_audit_events" ADD CONSTRAINT "accounting_audit_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "accounting_audit_events" ADD CONSTRAINT "accounting_audit_events_companyId_actorUserId_fkey" FOREIGN KEY ("companyId", "actorUserId") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_line_one_side_positive" CHECK ("debit" >= 0 AND "credit" >= 0 AND (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)));
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_posting_fields" CHECK (("status" IN ('DRAFT','CANCELLED')) OR ("postedAt" IS NOT NULL AND "postedById" IS NOT NULL));
INSERT INTO "ledger_accounts" ("id","companyId","code","name","accountClass","normalBalance","systemKey","isSystem","isActive","allowPosting","createdAt","updatedAt")
SELECT gen_random_uuid(), c.id, v.code, v.name, v.class::"LedgerAccountClass", v.normal::"NormalBalanceSide", v.key, true, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c CROSS JOIN (VALUES
('1000','Cash','ASSET','DEBIT','CASH'),('1100','Bank','ASSET','DEBIT','BANK'),('1200','Accounts Receivable','ASSET','DEBIT','ACCOUNTS_RECEIVABLE'),('1300','Inventory','ASSET','DEBIT','INVENTORY'),('1400','Advances','ASSET','DEBIT','ADVANCES'),('1500','Fixed Assets','ASSET','DEBIT','FIXED_ASSETS'),('2000','Accounts Payable','LIABILITY','CREDIT','ACCOUNTS_PAYABLE'),('2100','Taxes Payable','LIABILITY','CREDIT','TAXES_PAYABLE'),('2200','Loans','LIABILITY','CREDIT','LOANS'),('3000','Owner Capital','EQUITY','CREDIT','OWNER_CAPITAL'),('3100','Drawings','EQUITY','DEBIT','DRAWINGS'),('3200','Retained Earnings','EQUITY','CREDIT','RETAINED_EARNINGS'),('3300','Opening Balance Equity','EQUITY','CREDIT','OPENING_BALANCE_EQUITY'),('4000','Sales / Service Income','INCOME','CREDIT','SALES_INCOME'),('4100','Other Income','INCOME','CREDIT','OTHER_INCOME'),('5000','Purchase / Cost','EXPENSE','DEBIT','PURCHASE_COST'),('5100','General Expenses','EXPENSE','DEBIT','GENERAL_EXPENSES')) v(code,name,class,normal,key)
WHERE c."productEdition" IN ('SALESPUNCH360_ACCOUNT','SALESPUNCH360_PLUS') ON CONFLICT ("companyId","systemKey") DO NOTHING;

CREATE FUNCTION protect_journal_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE line_count integer; debit_total numeric(18,2); credit_total numeric(18,2);
BEGIN
 IF current_setting('app.account_cleanup_company_id', true) = OLD."companyId"::text THEN RETURN NEW; END IF;
 IF OLD."status" = 'DRAFT' AND NEW."status" = 'DRAFT' THEN RETURN NEW; END IF;
 IF OLD."status" = 'DRAFT' AND NEW."status" = 'CANCELLED' THEN RETURN NEW; END IF;
 IF OLD."status" = 'DRAFT' AND NEW."status" = 'POSTED' THEN
   IF ROW(OLD."companyId",OLD."financialYearId",OLD."branchId",OLD."journalNumber",OLD."entryDate",OLD."reference",OLD."narration",OLD."sourceType",OLD."sourceId",OLD."postingPurpose",OLD."reversalOfId",OLD."reversalReason",OLD."createdById",OLD."createdAt") IS DISTINCT FROM ROW(NEW."companyId",NEW."financialYearId",NEW."branchId",NEW."journalNumber",NEW."entryDate",NEW."reference",NEW."narration",NEW."sourceType",NEW."sourceId",NEW."postingPurpose",NEW."reversalOfId",NEW."reversalReason",NEW."createdById",NEW."createdAt") THEN RAISE EXCEPTION 'posting transition cannot mutate journal identity'; END IF;
   SELECT COUNT(*),COALESCE(SUM("debit"),0),COALESCE(SUM("credit"),0) INTO line_count,debit_total,credit_total FROM "journal_lines" WHERE "journalEntryId"=OLD.id;
   IF NEW."postedAt" IS NULL OR NEW."postedById" IS NULL OR line_count < 2 OR debit_total <= 0 OR debit_total <> credit_total THEN RAISE EXCEPTION 'journal is not balanced for posting'; END IF;
   RETURN NEW;
 END IF;
 IF OLD."status" = 'POSTED' AND NEW."status" = 'REVERSED' THEN
   IF ROW(OLD."companyId",OLD."financialYearId",OLD."branchId",OLD."journalNumber",OLD."entryDate",OLD."reference",OLD."narration",OLD."sourceType",OLD."sourceId",OLD."postingPurpose",OLD."reversalOfId",OLD."reversalReason",OLD."createdById",OLD."postedById",OLD."postedAt",OLD."createdAt") IS DISTINCT FROM ROW(NEW."companyId",NEW."financialYearId",NEW."branchId",NEW."journalNumber",NEW."entryDate",NEW."reference",NEW."narration",NEW."sourceType",NEW."sourceId",NEW."postingPurpose",NEW."reversalOfId",NEW."reversalReason",NEW."createdById",NEW."postedById",NEW."postedAt",NEW."createdAt") THEN RAISE EXCEPTION 'reversal transition cannot mutate posted journal'; END IF;
   RETURN NEW;
 END IF;
 RAISE EXCEPTION 'invalid journal lifecycle transition';
END $$;
CREATE TRIGGER journal_entry_lifecycle BEFORE UPDATE ON "journal_entries" FOR EACH ROW EXECUTE FUNCTION protect_journal_lifecycle();
CREATE FUNCTION protect_posted_journal_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF current_setting('app.account_cleanup_company_id', true) = OLD."companyId"::text THEN RETURN OLD; END IF; IF OLD."status" <> 'DRAFT' THEN RAISE EXCEPTION 'non-draft journal cannot be deleted'; END IF; RETURN OLD; END $$;
CREATE TRIGGER journal_entry_no_delete BEFORE DELETE ON "journal_entries" FOR EACH ROW EXECUTE FUNCTION protect_posted_journal_delete();
CREATE FUNCTION protect_journal_lines() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_status "JournalStatus"; new_status "JournalStatus"; old_parent_company uuid; new_parent_company uuid; marker text;
BEGIN
 marker := current_setting('app.account_cleanup_company_id', true);
 IF TG_OP = 'INSERT' THEN
   IF marker = NEW."companyId"::text THEN RETURN NEW; END IF;
   SELECT "status", "companyId" INTO new_status, new_parent_company FROM "journal_entries" WHERE id=NEW."journalEntryId";
   IF new_status IS DISTINCT FROM 'DRAFT' OR new_parent_company IS DISTINCT FROM NEW."companyId" THEN RAISE EXCEPTION 'journal lines may be inserted only into a same-company draft'; END IF;
   RETURN NEW;
 ELSIF TG_OP = 'DELETE' THEN
   IF marker = OLD."companyId"::text THEN RETURN OLD; END IF;
   SELECT "status", "companyId" INTO old_status, old_parent_company FROM "journal_entries" WHERE id=OLD."journalEntryId";
   IF old_status IS DISTINCT FROM 'DRAFT' OR old_parent_company IS DISTINCT FROM OLD."companyId" THEN RAISE EXCEPTION 'only draft journal lines may be deleted'; END IF;
   RETURN OLD;
 ELSE
   IF marker = OLD."companyId"::text AND NEW."companyId" = OLD."companyId" THEN RETURN NEW; END IF;
   SELECT "status", "companyId" INTO old_status, old_parent_company FROM "journal_entries" WHERE id=OLD."journalEntryId";
   SELECT "status", "companyId" INTO new_status, new_parent_company FROM "journal_entries" WHERE id=NEW."journalEntryId";
   IF old_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'posted or reversed journal lines are immutable'; END IF;
   IF new_status IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'draft lines may move only to another draft'; END IF;
   IF NEW."companyId" IS DISTINCT FROM OLD."companyId" OR old_parent_company IS DISTINCT FROM OLD."companyId" OR new_parent_company IS DISTINCT FROM OLD."companyId" THEN RAISE EXCEPTION 'journal line company cannot change'; END IF;
   RETURN NEW;
 END IF;
END $$;
CREATE TRIGGER journal_line_draft_only BEFORE INSERT OR UPDATE OR DELETE ON "journal_lines" FOR EACH ROW EXECUTE FUNCTION protect_journal_lines();
CREATE FUNCTION protect_accounting_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF current_setting('app.account_cleanup_company_id', true) = OLD."companyId"::text THEN RETURN OLD; END IF; RAISE EXCEPTION 'accounting audit is append-only'; END $$;
CREATE TRIGGER accounting_audit_append_only BEFORE UPDATE OR DELETE ON "accounting_audit_events" FOR EACH ROW EXECUTE FUNCTION protect_accounting_audit();
COMMIT;
