-- One concurrent index per migration: PostgreSQL disallows batching these in a transaction.
-- On failure inspect/drop only this migration's invalid index before reviewed retry.
CREATE INDEX CONCURRENTLY "money_accounts_companyId_type_isActive_idx" ON "money_accounts"("companyId", "type", "isActive");
