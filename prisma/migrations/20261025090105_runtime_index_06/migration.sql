-- One concurrent index per migration: PostgreSQL disallows batching these in a transaction.
-- On failure inspect/drop only this migration's invalid index before reviewed retry.
CREATE INDEX CONCURRENTLY "expense_transactions_companyId_projectId_status_idx" ON "expense_transactions"("companyId", "projectId", "status");
