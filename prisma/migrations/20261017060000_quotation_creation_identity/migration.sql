-- Optional retry identity for new estimates/quotations; preserve all legacy records.
ALTER TABLE "quotation_documents"
  ADD COLUMN "creationRequestKey" UUID,
  ADD COLUMN "creationRequestHash" VARCHAR(64);
CREATE UNIQUE INDEX "quotation_documents_companyId_creationRequestKey_key"
  ON "quotation_documents"("companyId", "creationRequestKey");
