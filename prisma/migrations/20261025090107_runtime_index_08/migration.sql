-- One concurrent index per migration: PostgreSQL disallows batching these in a transaction.
-- On failure inspect/drop only this migration's invalid index before reviewed retry.
CREATE INDEX CONCURRENTLY "expense_attachments_companyId_expenseId_idx" ON "expense_attachments"("companyId", "expenseId");
