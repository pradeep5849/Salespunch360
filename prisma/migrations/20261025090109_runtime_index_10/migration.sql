-- One concurrent index per migration: PostgreSQL disallows batching these in a transaction.
-- On failure inspect/drop only this migration's invalid index before reviewed retry.
CREATE INDEX CONCURRENTLY "loans_companyId_status_idx" ON "loans"("companyId", "status");
