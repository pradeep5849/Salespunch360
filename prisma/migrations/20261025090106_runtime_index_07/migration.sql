-- One concurrent index per migration: PostgreSQL disallows batching these in a transaction.
-- On failure inspect/drop only this migration's invalid index before reviewed retry.
CREATE INDEX CONCURRENTLY "recurring_expense_templates_companyId_nextDueDate_isActive_idx" ON "recurring_expense_templates"("companyId", "nextDueDate", "isActive");
