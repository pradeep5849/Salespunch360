-- One concurrent index per migration: PostgreSQL disallows batching these in a transaction.
-- On failure inspect/drop only this migration's invalid index before reviewed retry.
CREATE INDEX CONCURRENTLY "account_settlements_companyId_partyId_transactionDate_idx" ON "account_settlements"("companyId", "partyId", "transactionDate");
