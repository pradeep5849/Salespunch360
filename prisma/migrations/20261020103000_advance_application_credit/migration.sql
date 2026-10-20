-- Release an applied advance by a new, linked reclassification, preserving the
-- original application and its journal. No historical rows are rewritten.
ALTER TABLE account_settlements ADD COLUMN "advanceCreditSourceApplicationId" UUID;
CREATE UNIQUE INDEX advance_applications_company_id_key ON advance_applications("companyId",id);
CREATE UNIQUE INDEX account_settlements_advance_credit_source_key ON account_settlements("companyId","advanceCreditSourceApplicationId");
ALTER TABLE account_settlements ADD CONSTRAINT advance_credit_source_fkey FOREIGN KEY("companyId","advanceCreditSourceApplicationId") REFERENCES advance_applications("companyId",id) ON DELETE NO ACTION ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE account_settlements DROP CONSTRAINT receipt_credit_mode_valid;
ALTER TABLE account_settlements ADD CONSTRAINT correction_credit_mode_valid CHECK (
 ("receiptCreditSourceAllocationId" IS NULL AND "advanceCreditSourceApplicationId" IS NULL AND "paymentMode"::text<>'ACCOUNT_CREDIT') OR
 ((("receiptCreditSourceAllocationId" IS NOT NULL)::int+("advanceCreditSourceApplicationId" IS NOT NULL)::int)=1 AND "paymentMode"::text='ACCOUNT_CREDIT' AND type::text='CUSTOMER_ADVANCE' AND status::text='POSTED' AND "moneyAccountId" IS NULL AND "journalEntryId" IS NOT NULL)
);
CREATE FUNCTION validate_advance_application_credit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source RECORD; journal RECORD; ar NUMERIC; adv NUMERIC; invalid INTEGER;
BEGIN
 IF NEW."advanceCreditSourceApplicationId" IS NULL THEN RETURN NEW; END IF;
 SELECT a.amount,a."applicationDate",p."partyId",p."branchId",p.status::text AS payment_status,p.type::text AS payment_type,pj.status::text AS payment_journal_status,aj.status::text AS application_status,d.status::text AS document_status,d.type::text AS document_type,d."partyId" AS document_party,d."branchId" AS document_branch,d."projectId"
 INTO source FROM advance_applications a JOIN account_settlements p ON p.id=a."advanceId" AND p."companyId"=a."companyId"
 JOIN journal_entries pj ON pj.id=p."journalEntryId" AND pj."companyId"=p."companyId"
 JOIN journal_entries aj ON aj.id=a."journalEntryId" AND aj."companyId"=a."companyId"
 JOIN commercial_documents d ON d.id=a."documentId" AND d."companyId"=a."companyId"
 WHERE a.id=NEW."advanceCreditSourceApplicationId" AND a."companyId"=NEW."companyId";
 IF NOT FOUND OR source.payment_type<>'CUSTOMER_ADVANCE' OR source.payment_status<>'POSTED' OR source.payment_journal_status<>'POSTED' OR source.application_status<>'POSTED'
 OR source.document_type<>'SALES_INVOICE' OR source.document_status<>'POSTED'
 OR source."partyId"<>NEW."partyId" OR source.document_party<>NEW."partyId" OR source."branchId"<>NEW."branchId" OR source.document_branch<>NEW."branchId"
 OR source."projectId" IS DISTINCT FROM NEW."projectId" OR NEW.amount<>source.amount OR NEW."remainingAmount"<>NEW.amount OR NEW."transactionDate"<source."applicationDate"
 THEN RAISE EXCEPTION 'INVALID_ADVANCE_APPLICATION_CREDIT'; END IF;
 SELECT * INTO journal FROM journal_entries WHERE id=NEW."journalEntryId" AND "companyId"=NEW."companyId";
 IF NOT FOUND OR journal.status::text<>'POSTED' OR journal."sourceType"<>'CUSTOMER_ADVANCE' OR journal."sourceId" IS DISTINCT FROM NEW.id::text OR journal."branchId"<>NEW."branchId" OR journal."entryDate"<>NEW."transactionDate"
 THEN RAISE EXCEPTION 'INVALID_RECEIPT_ADVANCE_CREDIT_JOURNAL'; END IF;
 SELECT COALESCE(SUM(l.debit-l.credit) FILTER(WHERE a."systemKey"='ACCOUNTS_RECEIVABLE'),0),COALESCE(SUM(l.credit-l.debit) FILTER(WHERE a."systemKey"='CUSTOMER_ADVANCES'),0),COUNT(*) FILTER(WHERE a."systemKey" IS NULL OR a."systemKey" NOT IN('ACCOUNTS_RECEIVABLE','CUSTOMER_ADVANCES'))
 INTO ar,adv,invalid FROM journal_lines l JOIN ledger_accounts a ON a.id=l."ledgerAccountId" AND a."companyId"=l."companyId" WHERE l."companyId"=NEW."companyId" AND l."journalEntryId"=NEW."journalEntryId";
 IF ar<>NEW.amount OR adv<>NEW.amount OR invalid<>0 THEN RAISE EXCEPTION 'INVALID_RECEIPT_ADVANCE_CREDIT_JOURNAL'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER advance_application_credit_valid BEFORE INSERT ON account_settlements FOR EACH ROW EXECUTE FUNCTION validate_advance_application_credit();
CREATE FUNCTION validate_receipt_credit_date() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."receiptCreditSourceAllocationId" IS NOT NULL AND EXISTS(SELECT 1 FROM settlement_allocations a JOIN account_settlements p ON p.id=a."settlementId" AND p."companyId"=a."companyId" JOIN commercial_documents d ON d.id=a."documentId" AND d."companyId"=a."companyId" WHERE a.id=NEW."receiptCreditSourceAllocationId" AND a."companyId"=NEW."companyId" AND (NEW."transactionDate"<p."transactionDate" OR NEW."transactionDate"<d."issueDate"))
 THEN RAISE EXCEPTION 'INVALID_RECEIPT_ADVANCE_CREDIT_DATE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receipt_credit_date_valid BEFORE INSERT ON account_settlements FOR EACH ROW EXECUTE FUNCTION validate_receipt_credit_date();
CREATE OR REPLACE FUNCTION guard_receipt_credit_journal_reversal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status::text='POSTED' AND NEW.status::text='REVERSED' THEN
  IF EXISTS(SELECT 1 FROM account_settlements c WHERE c."companyId"=OLD."companyId" AND c."journalEntryId"=OLD.id AND c."paymentMode"::text='ACCOUNT_CREDIT')
  THEN RAISE EXCEPTION 'RECEIPT_ADVANCE_CREDIT_NOT_REVERSIBLE'; END IF;
  IF EXISTS(SELECT 1 FROM account_settlements c
   LEFT JOIN settlement_allocations a ON a.id=c."receiptCreditSourceAllocationId" AND a."companyId"=c."companyId"
   LEFT JOIN account_settlements p ON p.id=a."settlementId" AND p."companyId"=a."companyId"
   LEFT JOIN advance_applications ap ON ap.id=c."advanceCreditSourceApplicationId" AND ap."companyId"=c."companyId"
   LEFT JOIN account_settlements av ON av.id=ap."advanceId" AND av."companyId"=ap."companyId"
   WHERE c."companyId"=OLD."companyId" AND (p."journalEntryId"=OLD.id OR ap."journalEntryId"=OLD.id OR av."journalEntryId"=OLD.id))
  THEN RAISE EXCEPTION 'RECEIPT_HAS_ADVANCE_CREDIT'; END IF;
 END IF;
 RETURN NEW;
END $$;
