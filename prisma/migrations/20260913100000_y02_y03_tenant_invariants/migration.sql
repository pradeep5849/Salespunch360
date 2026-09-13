-- Y-02/Y-03 forward-only tenant and concurrency invariants.
-- The journal-side key is intentionally exclusive: split party openings require a future explicit split model.
CREATE UNIQUE INDEX "party_opening_balances_companyId_id_key"
  ON "party_opening_balances"("companyId", "id");
CREATE UNIQUE INDEX "party_opening_balances_companyId_journalEntryId_partyType_key"
  ON "party_opening_balances"("companyId", "journalEntryId", "partyType");

ALTER TABLE "opening_balance_allocations"
  DROP CONSTRAINT "opening_balance_allocations_opening_fkey",
  ADD CONSTRAINT "opening_balance_allocations_opening_fkey"
    FOREIGN KEY ("companyId", "openingBalanceId")
    REFERENCES "party_opening_balances"("companyId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "authorized_signature_versions_companyId_id_key"
  ON "authorized_signature_versions"("companyId", "id");
CREATE UNIQUE INDEX "authorized_signature_versions_one_current_per_company"
  ON "authorized_signature_versions"("companyId") WHERE "isCurrent" = true;

ALTER TABLE "commercial_documents"
  DROP CONSTRAINT "commercial_documents_signatureVersionId_fkey",
  ADD CONSTRAINT "commercial_documents_signatureVersionId_fkey"
    FOREIGN KEY ("companyId", "signatureVersionId")
    REFERENCES "authorized_signature_versions"("companyId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;
