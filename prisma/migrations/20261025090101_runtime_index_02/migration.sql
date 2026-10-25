-- One concurrent index per migration: PostgreSQL disallows batching these in a transaction.
-- On failure inspect/drop only this migration's invalid index before reviewed retry.
CREATE INDEX CONCURRENTLY "commercial_documents_companyId_customerId_idx" ON "commercial_documents"("companyId", "customerId");
