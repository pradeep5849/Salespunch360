-- Original receipt and allocation rows remain unchanged. The linked non-cash
-- advance is the append-only release event and has its own reclassification journal.
ALTER TYPE "PaymentMode" ADD VALUE 'ACCOUNT_CREDIT';
ALTER TABLE account_settlements ADD COLUMN "receiptCreditSourceAllocationId" UUID;
CREATE UNIQUE INDEX settlement_allocations_company_id_key ON settlement_allocations("companyId",id);
CREATE UNIQUE INDEX account_settlements_receipt_credit_source_key ON account_settlements("companyId","receiptCreditSourceAllocationId");
ALTER TABLE account_settlements ADD CONSTRAINT receipt_credit_source_fkey FOREIGN KEY("companyId","receiptCreditSourceAllocationId") REFERENCES settlement_allocations("companyId",id) ON DELETE NO ACTION ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE account_settlements ADD CONSTRAINT receipt_credit_mode_valid CHECK (
 ("receiptCreditSourceAllocationId" IS NULL AND "paymentMode"::text<>'ACCOUNT_CREDIT') OR
 ("receiptCreditSourceAllocationId" IS NOT NULL AND "paymentMode"::text='ACCOUNT_CREDIT' AND type::text='CUSTOMER_ADVANCE' AND status::text='POSTED' AND "moneyAccountId" IS NULL AND "journalEntryId" IS NOT NULL)
);
CREATE FUNCTION validate_receipt_advance_credit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allocation RECORD; journal RECORD; ar NUMERIC; adv NUMERIC; discount NUMERIC; invalid INTEGER;
BEGIN
 IF NEW."receiptCreditSourceAllocationId" IS NULL THEN RETURN NEW; END IF;
 SELECT a.amount,a."discountAmount",p."partyId",p."branchId",d."projectId",p.status::text AS payment_status,p.type::text AS payment_type,j.status::text AS payment_journal_status,d.status::text AS document_status,d.type::text AS document_type,d."partyId" AS document_party,d."branchId" AS document_branch
 INTO allocation FROM settlement_allocations a JOIN account_settlements p ON p.id=a."settlementId" AND p."companyId"=a."companyId"
 JOIN journal_entries j ON j.id=p."journalEntryId" AND j."companyId"=p."companyId"
 JOIN commercial_documents d ON d.id=a."documentId" AND d."companyId"=a."companyId"
 WHERE a.id=NEW."receiptCreditSourceAllocationId" AND a."companyId"=NEW."companyId";
 IF NOT FOUND OR allocation.payment_status<>'POSTED' OR allocation.payment_type<>'CUSTOMER_RECEIPT' OR allocation.payment_journal_status<>'POSTED'
 OR allocation.document_status<>'POSTED' OR allocation.document_type<>'SALES_INVOICE'
 OR allocation."partyId"<>NEW."partyId" OR allocation.document_party<>NEW."partyId"
 OR allocation."branchId"<>NEW."branchId" OR allocation.document_branch<>NEW."branchId"
 OR allocation."projectId" IS DISTINCT FROM NEW."projectId"
 OR NEW.amount<>allocation.amount-allocation."discountAmount" OR NEW."remainingAmount"<>NEW.amount
 THEN RAISE EXCEPTION 'INVALID_RECEIPT_ADVANCE_CREDIT'; END IF;
 SELECT * INTO journal FROM journal_entries WHERE id=NEW."journalEntryId" AND "companyId"=NEW."companyId";
 IF NOT FOUND OR journal.status::text<>'POSTED' OR journal."sourceType"<>'CUSTOMER_ADVANCE' OR journal."sourceId" IS DISTINCT FROM NEW.id::text
 OR journal."branchId"<>NEW."branchId" OR journal."entryDate"<>NEW."transactionDate"
 THEN RAISE EXCEPTION 'INVALID_RECEIPT_ADVANCE_CREDIT_JOURNAL'; END IF;
 SELECT COALESCE(SUM(l.debit-l.credit) FILTER(WHERE a."systemKey"='ACCOUNTS_RECEIVABLE'),0),
 COALESCE(SUM(l.credit-l.debit) FILTER(WHERE a."systemKey"='CUSTOMER_ADVANCES'),0),
 COALESCE(SUM(l.credit-l.debit) FILTER(WHERE a."systemKey"='SALES_INCOME'),0),
 COUNT(*) FILTER(WHERE a."systemKey" IS NULL OR a."systemKey" NOT IN('ACCOUNTS_RECEIVABLE','CUSTOMER_ADVANCES','SALES_INCOME'))
 INTO ar,adv,discount,invalid FROM journal_lines l JOIN ledger_accounts a ON a.id=l."ledgerAccountId" AND a."companyId"=l."companyId"
 WHERE l."companyId"=NEW."companyId" AND l."journalEntryId"=NEW."journalEntryId";
 IF ar<>allocation.amount OR adv<>NEW.amount OR discount<>allocation."discountAmount" OR invalid<>0
 THEN RAISE EXCEPTION 'INVALID_RECEIPT_ADVANCE_CREDIT_JOURNAL'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receipt_advance_credit_valid BEFORE INSERT ON account_settlements FOR EACH ROW EXECUTE FUNCTION validate_receipt_advance_credit();
-- Neither a source receipt nor its credit may be independently reversed after
-- reclassification: that would leave an effective allocation or advance orphaned.
CREATE FUNCTION guard_receipt_credit_journal_reversal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status::text='POSTED' AND NEW.status::text='REVERSED' THEN
  IF EXISTS(SELECT 1 FROM account_settlements c WHERE c."companyId"=OLD."companyId" AND c."journalEntryId"=OLD.id AND c."receiptCreditSourceAllocationId" IS NOT NULL)
  THEN RAISE EXCEPTION 'RECEIPT_ADVANCE_CREDIT_NOT_REVERSIBLE'; END IF;
  IF EXISTS(SELECT 1 FROM account_settlements p JOIN settlement_allocations a ON a."settlementId"=p.id AND a."companyId"=p."companyId" JOIN account_settlements c ON c."receiptCreditSourceAllocationId"=a.id AND c."companyId"=a."companyId" WHERE p."companyId"=OLD."companyId" AND p."journalEntryId"=OLD.id)
  THEN RAISE EXCEPTION 'RECEIPT_HAS_ADVANCE_CREDIT'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receipt_credit_reversal_guard BEFORE UPDATE OF status ON journal_entries FOR EACH ROW EXECUTE FUNCTION guard_receipt_credit_journal_reversal();
