-- Nullable request identities preserve historical documents and legacy clients.
ALTER TABLE "commercial_documents"
  ADD COLUMN "creationRequestKey" VARCHAR(120),
  ADD COLUMN "creationRequestHash" VARCHAR(64);
CREATE UNIQUE INDEX "commercial_documents_companyId_creationRequestKey_key"
  ON "commercial_documents"("companyId", "creationRequestKey");
