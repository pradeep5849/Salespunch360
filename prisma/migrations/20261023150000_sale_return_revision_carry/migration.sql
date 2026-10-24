-- AlterTable
ALTER TABLE "account_settlements" ADD COLUMN     "saleRevisionCreditSourceId" UUID;

-- CreateTable
CREATE TABLE "sale_return_revisions" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "sourceInvoiceId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "reversalJournalId" UUID NOT NULL,
    "postingDate" DATE NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_return_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_revision_credits" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "creditNoteId" UUID NOT NULL,
    "originalAmount" DECIMAL(18,2) NOT NULL,
    "availableAmount" DECIMAL(18,2) NOT NULL,
    "appliedAmount" DECIMAL(18,2) NOT NULL,
    "excessAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_revision_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_revision_credit_lines" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "creditId" UUID NOT NULL,
    "creditLineId" UUID NOT NULL,
    "invoiceLineId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "physicalQuantity" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_revision_credit_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_lifecycle_snapshots" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "state" VARCHAR(16) NOT NULL,
    "auditId" UUID NOT NULL,
    "replacementId" UUID,
    "correctionCreditId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_lifecycle_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sale_return_revisions_companyId_id_key" ON "sale_return_revisions"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_return_revisions_companyId_sourceInvoiceId_key" ON "sale_return_revisions"("companyId", "sourceInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_return_revisions_companyId_invoiceId_key" ON "sale_return_revisions"("companyId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_return_revisions_companyId_reversalJournalId_key" ON "sale_return_revisions"("companyId", "reversalJournalId");

-- CreateIndex
CREATE INDEX "sale_revision_credits_companyId_creditNoteId_idx" ON "sale_revision_credits"("companyId", "creditNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_revision_credits_companyId_id_key" ON "sale_revision_credits"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_revision_credits_companyId_revisionId_creditNoteId_key" ON "sale_revision_credits"("companyId", "revisionId", "creditNoteId");

-- CreateIndex
CREATE INDEX "sale_revision_credit_lines_companyId_invoiceLineId_idx" ON "sale_revision_credit_lines"("companyId", "invoiceLineId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_revision_credit_lines_companyId_id_key" ON "sale_revision_credit_lines"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_revision_credit_lines_companyId_creditId_creditLineId_key" ON "sale_revision_credit_lines"("companyId", "creditId", "creditLineId");

-- CreateIndex
CREATE INDEX "sale_lifecycle_snapshots_companyId_state_invoiceId_idx" ON "sale_lifecycle_snapshots"("companyId", "state", "invoiceId");

-- CreateIndex
CREATE INDEX "sale_lifecycle_snapshots_companyId_replacementId_idx" ON "sale_lifecycle_snapshots"("companyId", "replacementId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_lifecycle_snapshots_companyId_id_key" ON "sale_lifecycle_snapshots"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_lifecycle_snapshots_companyId_invoiceId_key" ON "sale_lifecycle_snapshots"("companyId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_lifecycle_snapshots_companyId_auditId_key" ON "sale_lifecycle_snapshots"("companyId", "auditId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_lifecycle_snapshots_companyId_correctionCreditId_key" ON "sale_lifecycle_snapshots"("companyId", "correctionCreditId");

-- CreateIndex
CREATE UNIQUE INDEX "account_settlement_sale_revision_credit_key" ON "account_settlements"("companyId", "saleRevisionCreditSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "account_operational_audits_companyId_id_key" ON "account_operational_audits"("companyId", "id");

-- AddForeignKey
ALTER TABLE "account_settlements" ADD CONSTRAINT "sale_revision_advance_source_fkey" FOREIGN KEY ("companyId", "saleRevisionCreditSourceId") REFERENCES "sale_revision_credits"("companyId", "id") ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_return_revisions" ADD CONSTRAINT "sale_return_revisions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_return_revisions" ADD CONSTRAINT "sale_return_revisions_companyId_sourceInvoiceId_fkey" FOREIGN KEY ("companyId", "sourceInvoiceId") REFERENCES "commercial_documents"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_return_revisions" ADD CONSTRAINT "sale_return_revisions_companyId_invoiceId_fkey" FOREIGN KEY ("companyId", "invoiceId") REFERENCES "commercial_documents"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_return_revisions" ADD CONSTRAINT "sale_return_revisions_companyId_reversalJournalId_fkey" FOREIGN KEY ("companyId", "reversalJournalId") REFERENCES "journal_entries"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_return_revisions" ADD CONSTRAINT "sale_return_revisions_companyId_createdById_fkey" FOREIGN KEY ("companyId", "createdById") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_revision_credits" ADD CONSTRAINT "sale_revision_credits_companyId_revisionId_fkey" FOREIGN KEY ("companyId", "revisionId") REFERENCES "sale_return_revisions"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_revision_credits" ADD CONSTRAINT "sale_revision_credits_companyId_creditNoteId_fkey" FOREIGN KEY ("companyId", "creditNoteId") REFERENCES "commercial_documents"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_revision_credit_lines" ADD CONSTRAINT "sale_revision_credit_lines_companyId_creditId_fkey" FOREIGN KEY ("companyId", "creditId") REFERENCES "sale_revision_credits"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_revision_credit_lines" ADD CONSTRAINT "sale_revision_credit_lines_companyId_creditLineId_fkey" FOREIGN KEY ("companyId", "creditLineId") REFERENCES "commercial_document_lines"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_revision_credit_lines" ADD CONSTRAINT "sale_revision_credit_lines_companyId_invoiceLineId_fkey" FOREIGN KEY ("companyId", "invoiceLineId") REFERENCES "commercial_document_lines"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_lifecycle_snapshots" ADD CONSTRAINT "sale_lifecycle_snapshots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_lifecycle_snapshots" ADD CONSTRAINT "sale_lifecycle_snapshots_companyId_invoiceId_fkey" FOREIGN KEY ("companyId", "invoiceId") REFERENCES "commercial_documents"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_lifecycle_snapshots" ADD CONSTRAINT "sale_lifecycle_audit_fkey" FOREIGN KEY ("companyId", "auditId") REFERENCES "account_operational_audits"("companyId", "id") ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_lifecycle_snapshots" ADD CONSTRAINT "sale_lifecycle_snapshots_companyId_replacementId_fkey" FOREIGN KEY ("companyId", "replacementId") REFERENCES "commercial_documents"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sale_lifecycle_snapshots" ADD CONSTRAINT "sale_lifecycle_snapshots_companyId_correctionCreditId_fkey" FOREIGN KEY ("companyId", "correctionCreditId") REFERENCES "commercial_documents"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Existing receipt/application correction links remain valid. A third, explicit
-- non-cash source represents the unused value of an immutable posted return.
ALTER TABLE account_settlements ALTER CONSTRAINT sale_revision_advance_source_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE account_settlements DROP CONSTRAINT correction_credit_mode_valid;
ALTER TABLE account_settlements ADD CONSTRAINT correction_credit_mode_valid CHECK (
 (num_nonnulls("receiptCreditSourceAllocationId","advanceCreditSourceApplicationId","saleRevisionCreditSourceId")=0 AND "paymentMode"::text<>'ACCOUNT_CREDIT') OR
 (num_nonnulls("receiptCreditSourceAllocationId","advanceCreditSourceApplicationId","saleRevisionCreditSourceId")=1 AND "paymentMode"::text='ACCOUNT_CREDIT' AND type::text='CUSTOMER_ADVANCE' AND status::text='POSTED' AND "moneyAccountId" IS NULL AND "journalEntryId" IS NOT NULL)
);
ALTER TABLE sale_return_revisions ADD CONSTRAINT sale_return_revision_distinct CHECK("sourceInvoiceId"<>"invoiceId");
ALTER TABLE sale_revision_credits ADD CONSTRAINT sale_revision_credit_amounts CHECK("originalAmount">=0 AND "availableAmount">=0 AND "availableAmount"<="originalAmount" AND "appliedAmount">=0 AND "excessAmount">=0 AND "availableAmount"="appliedAmount"+"excessAmount");
ALTER TABLE sale_revision_credit_lines ADD CONSTRAINT sale_revision_credit_quantities CHECK(quantity>0 AND "physicalQuantity">=0 AND "physicalQuantity"<=quantity);

CREATE FUNCTION guard_sale_return_revision_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('app.account_cleanup_company_id',true)=OLD."companyId"::text THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'SALE_RETURN_REVISION_HISTORY_IMMUTABLE';
END $$;
CREATE TRIGGER sale_return_revision_immutable BEFORE UPDATE OR DELETE ON sale_return_revisions FOR EACH ROW EXECUTE FUNCTION guard_sale_return_revision_history();
CREATE TRIGGER sale_revision_credit_immutable BEFORE UPDATE OR DELETE ON sale_revision_credits FOR EACH ROW EXECUTE FUNCTION guard_sale_return_revision_history();
CREATE TRIGGER sale_revision_credit_line_immutable BEFORE UPDATE OR DELETE ON sale_revision_credit_lines FOR EACH ROW EXECUTE FUNCTION guard_sale_return_revision_history();

CREATE FUNCTION validate_sale_return_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE revision RECORD; source RECORD; target RECORD; reversal RECORD;
BEGIN
 SELECT * INTO revision FROM sale_return_revisions WHERE id=NEW.id AND "companyId"=NEW."companyId";
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT d.*,j.status AS journal_status,j."entryDate" AS journal_date INTO source FROM commercial_documents d JOIN journal_entries j ON j.id=d."journalEntryId" AND j."companyId"=d."companyId" WHERE d.id=revision."sourceInvoiceId" AND d."companyId"=revision."companyId";
 IF NOT FOUND OR source.type::text<>'SALES_INVOICE' OR source.status::text<>'POSTED' OR source.journal_status::text<>'REVERSED' THEN RAISE EXCEPTION 'INVALID_RETURN_REVISION_SOURCE'; END IF;
 SELECT d.*,j.status AS journal_status,j."entryDate" AS journal_date,j."sourceType" AS journal_source,j."sourceId" AS journal_source_id INTO target FROM commercial_documents d JOIN journal_entries j ON j.id=d."journalEntryId" AND j."companyId"=d."companyId" WHERE d.id=revision."invoiceId" AND d."companyId"=revision."companyId";
 IF NOT FOUND OR target.type::text<>'SALES_INVOICE' OR target.status::text<>'POSTED' OR target.journal_status::text<>'POSTED' OR target."branchId"<>source."branchId" OR target."partyId"<>source."partyId" OR target."projectId" IS DISTINCT FROM source."projectId" OR target.journal_date<>revision."postingDate" OR target.journal_source<>'SALES_INVOICE' OR target.journal_source_id<>target.id::text THEN RAISE EXCEPTION 'INVALID_RETURN_REVISION_TARGET'; END IF;
 SELECT * INTO reversal FROM journal_entries WHERE id=revision."reversalJournalId" AND "companyId"=revision."companyId";
 IF NOT FOUND OR reversal.status::text<>'POSTED' OR reversal."reversalOfId"<>source."journalEntryId" OR reversal."branchId"<>source."branchId" OR reversal."entryDate"<>revision."postingDate" OR revision."postingDate"<GREATEST(source."issueDate",target."issueDate",source.journal_date) THEN RAISE EXCEPTION 'INVALID_RETURN_REVISION_JOURNAL'; END IF;
 IF reversal."sourceType"<>'REVERSAL' OR reversal."sourceId"<>source."journalEntryId"::text OR EXISTS(SELECT 1 FROM journal_lines WHERE "companyId"=revision."companyId" AND "journalEntryId" IN(source."journalEntryId",reversal.id) GROUP BY "ledgerAccountId","costCentreId" HAVING SUM(debit-credit)<>0) THEN RAISE EXCEPTION 'RETURN_REVISION_REVERSAL_NOT_EXACT'; END IF;
 IF EXISTS(SELECT 1 FROM stock_movements original WHERE original."companyId"=revision."companyId" AND original."sourceType"='SALES_INVOICE' AND original."sourceId"=source.id::text AND original."movementType"::text='SALE' AND NOT EXISTS(SELECT 1 FROM stock_movements correction WHERE correction."companyId"=original."companyId" AND correction."sourceType"='SALE_REVISION_REVERSAL' AND correction."sourceId"=source.id::text AND correction."sourceLineId"=original."sourceLineId" AND correction."movementType"::text='ADJUSTMENT_IN' AND ROW(correction."branchId",correction."warehouseId",correction."productId",correction.quantity,correction."unitCost",correction."totalCost",correction."batchId",correction."serialNumberId",correction."movementDate") IS NOT DISTINCT FROM ROW(original."branchId",original."warehouseId",original."productId",original.quantity,original."unitCost",original."totalCost",original."batchId",original."serialNumberId",revision."postingDate"))) THEN RAISE EXCEPTION 'RETURN_REVISION_STOCK_REVERSAL_INCOMPLETE'; END IF;
 IF EXISTS(SELECT 1 FROM stock_movements correction WHERE correction."companyId"=revision."companyId" AND correction."sourceType"='SALE_REVISION_REVERSAL' AND correction."sourceId"=source.id::text AND NOT EXISTS(SELECT 1 FROM stock_movements original WHERE original."companyId"=correction."companyId" AND original."sourceType"='SALES_INVOICE' AND original."sourceId"=source.id::text AND original."movementType"::text='SALE' AND original."sourceLineId"=correction."sourceLineId")) THEN RAISE EXCEPTION 'RETURN_REVISION_STOCK_SOURCE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM sale_revision_credits WHERE "revisionId"=revision.id AND "companyId"=revision."companyId") THEN RAISE EXCEPTION 'RETURN_REVISION_CREDITS_REQUIRED'; END IF;
 IF (SELECT COALESCE(SUM("appliedAmount"),0) FROM sale_revision_credits WHERE "revisionId"=revision.id AND "companyId"=revision."companyId")>COALESCE(target."payableAmount",target."grandTotal") THEN RAISE EXCEPTION 'RETURN_REVISION_CREDIT_OVERAPPLIED'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER sale_return_revision_valid AFTER INSERT ON sale_return_revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_sale_return_revision();

CREATE FUNCTION validate_sale_revision_credit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE carry RECORD; revision RECORD; note RECORD; target RECORD; converted NUMERIC; advance RECORD; ar NUMERIC; customer_advance NUMERIC; invalid INTEGER;
BEGIN
 SELECT * INTO carry FROM sale_revision_credits WHERE id=NEW.id AND "companyId"=NEW."companyId";
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO revision FROM sale_return_revisions WHERE id=carry."revisionId" AND "companyId"=carry."companyId";
 SELECT d.*,j.status AS journal_status INTO note FROM commercial_documents d JOIN journal_entries j ON j.id=d."journalEntryId" AND j."companyId"=d."companyId" WHERE d.id=carry."creditNoteId" AND d."companyId"=carry."companyId";
 IF NOT FOUND OR note.type::text<>'CREDIT_NOTE' OR note.status::text<>'POSTED' OR note.journal_status::text<>'POSTED' OR carry."originalAmount"<>COALESCE(note."payableAmount",note."grandTotal") OR note."issueDate">revision."postingDate" THEN RAISE EXCEPTION 'INVALID_RETAINED_CREDIT_NOTE'; END IF;
 SELECT * INTO target FROM commercial_documents WHERE id=revision."invoiceId" AND "companyId"=carry."companyId";
 IF note."branchId"<>target."branchId" OR note."partyId"<>target."partyId" OR note."projectId" IS DISTINCT FROM target."projectId" THEN RAISE EXCEPTION 'RETURN_REVISION_PARTY_PROJECT_MISMATCH'; END IF;
 IF note."sourceDocumentId"<>revision."sourceInvoiceId" AND NOT EXISTS(SELECT 1 FROM sale_revision_credits previous JOIN sale_return_revisions r ON r.id=previous."revisionId" AND r."companyId"=previous."companyId" WHERE r."invoiceId"=revision."sourceInvoiceId" AND r."companyId"=carry."companyId" AND previous."creditNoteId"=note.id) THEN RAISE EXCEPTION 'RETURN_REVISION_CREDIT_LINEAGE_REQUIRED'; END IF;
 SELECT COALESCE(SUM(s.amount),0) INTO converted FROM sale_revision_credits c JOIN account_settlements s ON s."saleRevisionCreditSourceId"=c.id AND s."companyId"=c."companyId" WHERE c."companyId"=carry."companyId" AND c."creditNoteId"=note.id AND c.id<>carry.id;
 IF carry."availableAmount"<>carry."originalAmount"-converted THEN RAISE EXCEPTION 'RETURN_REVISION_CREDIT_VALUE_CHANGED'; END IF;
 IF (SELECT COUNT(*) FROM commercial_document_lines WHERE "companyId"=carry."companyId" AND "documentId"=note.id)<>(SELECT COUNT(*) FROM sale_revision_credit_lines WHERE "companyId"=carry."companyId" AND "creditId"=carry.id) THEN RAISE EXCEPTION 'RETURN_REVISION_LINE_COVERAGE_REQUIRED'; END IF;
 SELECT s.*,j.status AS journal_status,j."sourceType" AS journal_source,j."sourceId" AS journal_source_id,j."entryDate" AS journal_date INTO advance FROM account_settlements s JOIN journal_entries j ON j.id=s."journalEntryId" AND j."companyId"=s."companyId" WHERE s."saleRevisionCreditSourceId"=carry.id AND s."companyId"=carry."companyId";
 IF carry."excessAmount"=0 THEN
  IF FOUND THEN RAISE EXCEPTION 'UNEXPECTED_RETURN_REVISION_ADVANCE'; END IF;
 ELSE
  IF NOT FOUND OR advance.amount<>carry."excessAmount" OR advance."partyId"<>note."partyId" OR advance."branchId"<>note."branchId" OR advance."projectId" IS DISTINCT FROM note."projectId" OR advance.type::text<>'CUSTOMER_ADVANCE' OR advance.status::text<>'POSTED' OR advance."paymentMode"::text<>'ACCOUNT_CREDIT' OR advance.journal_status::text<>'POSTED' OR advance.journal_source<>'CUSTOMER_ADVANCE' OR advance.journal_source_id<>advance.id::text OR advance.journal_date<>revision."postingDate" OR advance."transactionDate"<>revision."postingDate" THEN RAISE EXCEPTION 'INVALID_RETURN_REVISION_ADVANCE'; END IF;
  SELECT COALESCE(SUM(l.debit-l.credit) FILTER(WHERE a."systemKey"='ACCOUNTS_RECEIVABLE'),0),COALESCE(SUM(l.credit-l.debit) FILTER(WHERE a."systemKey"='CUSTOMER_ADVANCES'),0),COUNT(*) FILTER(WHERE a."systemKey" IS NULL OR a."systemKey" NOT IN('ACCOUNTS_RECEIVABLE','CUSTOMER_ADVANCES')) INTO ar,customer_advance,invalid FROM journal_lines l JOIN ledger_accounts a ON a.id=l."ledgerAccountId" AND a."companyId"=l."companyId" WHERE l."journalEntryId"=advance."journalEntryId" AND l."companyId"=carry."companyId";
  IF ar<>carry."excessAmount" OR customer_advance<>carry."excessAmount" OR invalid<>0 THEN RAISE EXCEPTION 'INVALID_RETURN_REVISION_ADVANCE_JOURNAL'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER sale_revision_credit_valid AFTER INSERT ON sale_revision_credits DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_sale_revision_credit();

CREATE FUNCTION validate_sale_revision_credit_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE binding RECORD; credit_line RECORD; invoice_line RECORD; target_invoice UUID; note_id UUID; physical NUMERIC;
BEGIN
 SELECT * INTO binding FROM sale_revision_credit_lines WHERE id=NEW.id AND "companyId"=NEW."companyId";
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT c."creditNoteId",r."invoiceId" INTO note_id,target_invoice FROM sale_revision_credits c JOIN sale_return_revisions r ON r.id=c."revisionId" AND r."companyId"=c."companyId" WHERE c.id=binding."creditId" AND c."companyId"=binding."companyId";
 SELECT * INTO credit_line FROM commercial_document_lines WHERE id=binding."creditLineId" AND "companyId"=binding."companyId" AND "documentId"=note_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_RETAINED_CREDIT_LINE'; END IF;
 SELECT * INTO invoice_line FROM commercial_document_lines WHERE id=binding."invoiceLineId" AND "companyId"=binding."companyId" AND "documentId"=target_invoice;
 IF NOT FOUND OR ROW(invoice_line."lineType",invoice_line."productId",invoice_line."serviceId",invoice_line."workPackageId",invoice_line."warehouseId",invoice_line."batchId",invoice_line."serialNumberId",invoice_line."unitName",invoice_line."unitSymbol",invoice_line."unitConversionSnapshot") IS DISTINCT FROM ROW(credit_line."lineType",credit_line."productId",credit_line."serviceId",credit_line."workPackageId",credit_line."warehouseId",credit_line."batchId",credit_line."serialNumberId",credit_line."unitName",credit_line."unitSymbol",credit_line."unitConversionSnapshot") THEN RAISE EXCEPTION 'RETURN_REVISION_ITEM_UNIT_MISMATCH'; END IF;
 physical:=round(credit_line."stockReturnQuantity"/CASE WHEN credit_line."unitConversionSnapshot"->>'selection'='SECONDARY' THEN (credit_line."unitConversionSnapshot"->>'secondaryUnitsPerBase')::numeric ELSE 1 END,4);
 IF binding.quantity<>COALESCE(credit_line."baseQuantity",credit_line.quantity) OR binding."physicalQuantity"<>physical THEN RAISE EXCEPTION 'RETURN_REVISION_QUANTITY_CHANGED'; END IF;
 IF (SELECT SUM(b.quantity) FROM sale_revision_credit_lines b JOIN sale_revision_credits c ON c.id=b."creditId" AND c."companyId"=b."companyId" JOIN sale_return_revisions r ON r.id=c."revisionId" AND r."companyId"=c."companyId" WHERE b."companyId"=binding."companyId" AND b."invoiceLineId"=invoice_line.id AND r."invoiceId"=target_invoice)>COALESCE(invoice_line."baseQuantity",invoice_line.quantity) THEN RAISE EXCEPTION 'SALE_MUST_COVER_POSTED_RETURNS'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER sale_revision_credit_line_valid AFTER INSERT ON sale_revision_credit_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_sale_revision_credit_line();

CREATE FUNCTION guard_retained_return_journal_reversal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice UUID;
BEGIN
 IF OLD.status::text='POSTED' AND NEW.status::text='REVERSED' THEN
  IF EXISTS(SELECT 1 FROM sale_revision_credits c JOIN commercial_documents d ON d.id=c."creditNoteId" AND d."companyId"=c."companyId" WHERE c."companyId"=OLD."companyId" AND d."journalEntryId"=OLD.id)
   OR EXISTS(SELECT 1 FROM sale_return_revisions WHERE "companyId"=OLD."companyId" AND "reversalJournalId"=OLD.id)
   OR EXISTS(SELECT 1 FROM account_settlements WHERE "companyId"=OLD."companyId" AND "journalEntryId"=OLD.id AND "saleRevisionCreditSourceId" IS NOT NULL)
  THEN RAISE EXCEPTION 'RETAINED_RETURN_HISTORY_REVERSAL_FORBIDDEN'; END IF;
  SELECT d.id INTO invoice FROM sale_return_revisions r JOIN commercial_documents d ON d.id=r."invoiceId" AND d."companyId"=r."companyId" WHERE r."companyId"=OLD."companyId" AND d."journalEntryId"=OLD.id;
  IF FOUND AND current_setting('app.sale_return_revision_source_id',true) IS DISTINCT FROM invoice::text THEN RAISE EXCEPTION 'SALE_RETURN_CORRECTION_WORKFLOW_REQUIRED'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER retained_return_journal_reversal_guard BEFORE UPDATE OF status ON journal_entries FOR EACH ROW EXECUTE FUNCTION guard_retained_return_journal_reversal();


CREATE FUNCTION guard_sale_revision_advance_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE amount NUMERIC;
BEGIN
 IF TG_OP='UPDATE' AND OLD."saleRevisionCreditSourceId" IS DISTINCT FROM NEW."saleRevisionCreditSourceId" THEN RAISE EXCEPTION 'SALE_REVISION_ADVANCE_SOURCE_IMMUTABLE'; END IF;
 IF NEW."saleRevisionCreditSourceId" IS NOT NULL THEN
  SELECT "excessAmount" INTO amount FROM sale_revision_credits WHERE id=NEW."saleRevisionCreditSourceId" AND "companyId"=NEW."companyId";
  IF NOT FOUND OR amount<=0 OR amount<>NEW.amount THEN RAISE EXCEPTION 'INVALID_RETURN_REVISION_ADVANCE'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sale_revision_advance_source_guard BEFORE INSERT OR UPDATE OF "saleRevisionCreditSourceId" ON account_settlements FOR EACH ROW EXECUTE FUNCTION guard_sale_revision_advance_source();

-- This read model records newly completed corrections without updating a posted
-- invoice. Legacy events remain available through the bounded audit fallback;
-- ambiguous historical records are deliberately not guessed or rewritten.
ALTER TABLE sale_lifecycle_snapshots ALTER CONSTRAINT sale_lifecycle_audit_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE sale_lifecycle_snapshots ADD CONSTRAINT sale_lifecycle_state CHECK(
 (state='CANCELLED' AND "replacementId" IS NULL AND "correctionCreditId" IS NOT NULL) OR
 (state='REVISED' AND "replacementId" IS NOT NULL AND "replacementId"<>"invoiceId")
);
CREATE TRIGGER sale_lifecycle_snapshot_immutable BEFORE UPDATE OR DELETE ON sale_lifecycle_snapshots FOR EACH ROW EXECUTE FUNCTION guard_sale_return_revision_history();
CREATE FUNCTION validate_sale_lifecycle_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snapshot RECORD; source RECORD; audit RECORD; target RECORD; credit RECORD;
BEGIN
 SELECT * INTO snapshot FROM sale_lifecycle_snapshots WHERE id=NEW.id AND "companyId"=NEW."companyId";
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT d.*,j.status AS journal_status INTO source FROM commercial_documents d JOIN journal_entries j ON j.id=d."journalEntryId" AND j."companyId"=d."companyId" WHERE d.id=snapshot."invoiceId" AND d."companyId"=snapshot."companyId";
 IF NOT FOUND OR source.type::text<>'SALES_INVOICE' OR source.status::text<>'POSTED' THEN RAISE EXCEPTION 'INVALID_SALE_LIFECYCLE_SOURCE'; END IF;
 SELECT * INTO audit FROM account_operational_audits WHERE id=snapshot."auditId" AND "companyId"=snapshot."companyId";
 IF NOT FOUND OR audit."entityType"<>'SALES_INVOICE' OR audit."entityId"<>source.id THEN RAISE EXCEPTION 'INVALID_SALE_LIFECYCLE_AUDIT'; END IF;
 IF snapshot.state='REVISED' THEN
  IF audit."eventType"<>'SALE_AMENDED' OR audit.metadata->>'replacementId' IS DISTINCT FROM snapshot."replacementId"::text THEN RAISE EXCEPTION 'INVALID_SALE_LIFECYCLE_AUDIT'; END IF;
  SELECT * INTO target FROM commercial_documents WHERE id=snapshot."replacementId" AND "companyId"=snapshot."companyId";
  IF NOT FOUND OR target.type::text<>'SALES_INVOICE' OR target.status::text<>'POSTED' OR target."branchId"<>source."branchId" THEN RAISE EXCEPTION 'INVALID_SALE_LIFECYCLE_TARGET'; END IF;
 ELSE
  IF audit."eventType"<>'SALE_REVERSED' OR audit.metadata->>'creditId' IS DISTINCT FROM snapshot."correctionCreditId"::text THEN RAISE EXCEPTION 'INVALID_SALE_LIFECYCLE_AUDIT'; END IF;
 END IF;
 IF snapshot."correctionCreditId" IS NOT NULL THEN
  SELECT d.*,j.status AS journal_status INTO credit FROM commercial_documents d JOIN journal_entries j ON j.id=d."journalEntryId" AND j."companyId"=d."companyId" WHERE d.id=snapshot."correctionCreditId" AND d."companyId"=snapshot."companyId";
  IF NOT FOUND OR credit.type::text<>'CREDIT_NOTE' OR credit.status::text<>'POSTED' OR credit.journal_status::text<>'POSTED' OR source.journal_status::text<>'POSTED' OR credit."sourceDocumentId" IS DISTINCT FROM source.id OR credit."branchId"<>source."branchId" OR credit."partyId" IS DISTINCT FROM source."partyId" OR COALESCE(credit."payableAmount",credit."grandTotal")<>COALESCE(source."payableAmount",source."grandTotal") THEN RAISE EXCEPTION 'INVALID_SALE_LIFECYCLE_CREDIT'; END IF;
  IF EXISTS(SELECT 1 FROM journal_lines jl WHERE jl."companyId"=snapshot."companyId" AND jl."journalEntryId" IN(source."journalEntryId",credit."journalEntryId") GROUP BY jl."ledgerAccountId",jl."costCentreId" HAVING SUM(jl.debit-jl.credit)<>0) THEN RAISE EXCEPTION 'SALE_LIFECYCLE_CREDIT_NOT_EXACT'; END IF;
 ELSE
  IF source.journal_status::text<>'REVERSED' OR NOT EXISTS(SELECT 1 FROM sale_return_revisions WHERE "companyId"=snapshot."companyId" AND "sourceInvoiceId"=source.id AND "invoiceId"=snapshot."replacementId") THEN RAISE EXCEPTION 'SALE_LIFECYCLE_RETURN_REVISION_REQUIRED'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER sale_lifecycle_snapshot_valid AFTER INSERT ON sale_lifecycle_snapshots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_sale_lifecycle_snapshot();
CREATE FUNCTION guard_sale_lifecycle_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('app.account_cleanup_company_id',true)=OLD."companyId"::text THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF EXISTS(SELECT 1 FROM sale_lifecycle_snapshots WHERE "companyId"=OLD."companyId" AND "auditId"=OLD.id) THEN RAISE EXCEPTION 'SALE_LIFECYCLE_AUDIT_IMMUTABLE'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER sale_lifecycle_audit_immutable BEFORE UPDATE OR DELETE ON account_operational_audits FOR EACH ROW EXECUTE FUNCTION guard_sale_lifecycle_audit();
CREATE FUNCTION guard_sale_lifecycle_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status::text='POSTED' AND NEW.status::text='REVERSED' AND EXISTS(
 SELECT 1 FROM sale_lifecycle_snapshots s JOIN commercial_documents d ON d."companyId"=s."companyId" AND d.id IN(s."invoiceId",s."correctionCreditId") WHERE s."companyId"=OLD."companyId" AND d."journalEntryId"=OLD.id
 ) THEN RAISE EXCEPTION 'SALE_LIFECYCLE_JOURNAL_PINNED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sale_lifecycle_journal_guard BEFORE UPDATE OF status ON journal_entries FOR EACH ROW EXECUTE FUNCTION guard_sale_lifecycle_journal();
