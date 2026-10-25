-- One concurrent index per migration: PostgreSQL disallows batching these in a transaction.
-- On failure inspect/drop only this migration's invalid index before reviewed retry.
CREATE INDEX CONCURRENTLY "commercial_audit_events_companyId_entityType_entityId_creat_idx" ON "commercial_audit_events"("companyId", "entityType", "entityId", "createdAt");
