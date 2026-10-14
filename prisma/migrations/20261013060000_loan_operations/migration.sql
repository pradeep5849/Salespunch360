-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "creationRequestHash" VARCHAR(64),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "loan_operations" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "loanId" UUID NOT NULL,
    "action" VARCHAR(24) NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "expectedVersion" INTEGER NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "amount" DECIMAL(18,2),
    "operationDate" DATE,
    "moneyAccountId" UUID,
    "journalEntryId" UUID,
    "createdById" UUID NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loan_operations_companyId_loanId_createdAt_idx" ON "loan_operations"("companyId", "loanId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "loan_operations_companyId_id_key" ON "loan_operations"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_operations_companyId_requestKey_key" ON "loan_operations"("companyId", "requestKey");

-- AddForeignKey
ALTER TABLE "loan_operations" ADD CONSTRAINT "loan_operations_loan_company_fkey" FOREIGN KEY ("companyId", "loanId") REFERENCES "loans"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "loan_operations" ADD CONSTRAINT "loan_operations_money_company_fkey" FOREIGN KEY ("companyId", "moneyAccountId") REFERENCES "money_accounts"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "loan_operations" ADD CONSTRAINT "loan_operations_journal_company_fkey" FOREIGN KEY ("companyId", "journalEntryId") REFERENCES "journal_entries"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "loan_operations" ADD CONSTRAINT "loan_operations_creator_company_fkey" FOREIGN KEY ("companyId", "createdById") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Operation requests and their audit snapshots are immutable; corrections append.
CREATE FUNCTION guard_loan_operation_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('app.account_cleanup_company_id',true)=OLD."companyId"::text THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'LOAN_OPERATION_IMMUTABLE';
END;
$$;
CREATE TRIGGER loan_operation_history_immutable BEFORE UPDATE OR DELETE ON "loan_operations" FOR EACH ROW EXECUTE FUNCTION guard_loan_operation_history();

CREATE FUNCTION guard_posted_loan_origin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('app.account_cleanup_company_id',true)=OLD."companyId"::text THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP='DELETE' THEN
  IF OLD."receivedJournalId" IS NOT NULL OR EXISTS(SELECT 1 FROM loan_operations WHERE "companyId"=OLD."companyId" AND "loanId"=OLD.id) THEN RAISE EXCEPTION 'LOAN_HISTORY_IMMUTABLE'; END IF;
  RETURN OLD;
 END IF;
 IF OLD."creationRequestHash" IS NOT NULL AND NEW."creationRequestHash" IS DISTINCT FROM OLD."creationRequestHash" THEN RAISE EXCEPTION 'LOAN_ORIGIN_FINGERPRINT_IMMUTABLE'; END IF;
 IF OLD."receivedJournalId" IS NOT NULL AND ROW(NEW."companyId",NEW."branchId",NEW.principal,NEW."moneyAccountId",NEW."liabilityLedgerId",NEW."startDate",NEW."receivedJournalId",NEW."createdById",NEW."idempotencyKey") IS DISTINCT FROM ROW(OLD."companyId",OLD."branchId",OLD.principal,OLD."moneyAccountId",OLD."liabilityLedgerId",OLD."startDate",OLD."receivedJournalId",OLD."createdById",OLD."idempotencyKey") THEN RAISE EXCEPTION 'LOAN_RECEIPT_IMMUTABLE'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER posted_loan_origin_immutable BEFORE UPDATE OR DELETE ON "loans" FOR EACH ROW EXECUTE FUNCTION guard_posted_loan_origin();
ALTER TABLE loans ADD CONSTRAINT loans_version_nonnegative CHECK(version>=0);
