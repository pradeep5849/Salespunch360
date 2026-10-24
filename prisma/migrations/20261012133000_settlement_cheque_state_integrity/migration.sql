-- Preserve the original posted-settlement journal requirement while allowing
-- explicitly pending cheques to wait for manual closure. No history is rewritten.
ALTER TABLE "account_settlements"
  ADD CONSTRAINT "account_settlements_cheque_journal_state_check"
  CHECK (
    (status = 'PENDING_CHEQUE' AND "paymentMode" = 'CHEQUE'
      AND "journalEntryId" IS NULL AND "remainingAmount" = 0 AND amount > 0)
    OR (status <> 'PENDING_CHEQUE' AND "journalEntryId" IS NOT NULL)
  );
