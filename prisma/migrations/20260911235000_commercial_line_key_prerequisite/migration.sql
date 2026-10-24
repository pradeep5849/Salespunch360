-- Existing asset/source-line FKs require this key on fresh databases.
-- Global line IDs are already primary keys; this adds the tenant-scoped key
-- without changing rows or historical migration checksums.
CREATE UNIQUE INDEX IF NOT EXISTS "commercial_document_lines_companyId_id_key"
  ON "commercial_document_lines"("companyId", "id");
