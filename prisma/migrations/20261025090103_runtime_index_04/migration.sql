-- One concurrent index per migration: PostgreSQL disallows batching these in a transaction.
-- On failure inspect/drop only this migration's invalid index before reviewed retry.
CREATE INDEX CONCURRENTLY "payment_reminders_companyId_remindAt_status_idx" ON "payment_reminders"("companyId", "remindAt", "status");
