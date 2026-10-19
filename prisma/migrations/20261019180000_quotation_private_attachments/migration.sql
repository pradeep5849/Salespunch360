CREATE TABLE "quotation_attachments" (
 "id" UUID NOT NULL, "companyId" UUID NOT NULL, "revisionId" UUID NOT NULL,
 "requestKey" UUID NOT NULL, "requestHash" CHAR(64) NOT NULL, "displayName" VARCHAR(240) NOT NULL,
 "mimeType" VARCHAR(120) NOT NULL, "sizeBytes" INTEGER NOT NULL, "contentHash" CHAR(64) NOT NULL,
 "storageKey" VARCHAR(512) NOT NULL, "uploadedById" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "quotation_attachments_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "quotation_attachments_size_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 10485760),
 CONSTRAINT "quotation_attachments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT "quotation_attachments_revision_fkey" FOREIGN KEY ("companyId","revisionId") REFERENCES "quotation_revisions"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT "quotation_attachments_uploader_fkey" FOREIGN KEY ("companyId","uploadedById") REFERENCES "users"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "quotation_attachments_companyId_id_key" ON "quotation_attachments"("companyId","id");
CREATE UNIQUE INDEX "quotation_attachments_companyId_revisionId_requestKey_key" ON "quotation_attachments"("companyId","revisionId","requestKey");
CREATE INDEX "quotation_attachments_companyId_revisionId_createdAt_idx" ON "quotation_attachments"("companyId","revisionId","createdAt");
CREATE INDEX "quotation_attachments_companyId_storageKey_idx" ON "quotation_attachments"("companyId","storageKey");
-- Reuse the existing OLD/NEW-parent and issued-history protection, including guarded fixture cleanup.
CREATE TRIGGER quotation_attachment_immutable BEFORE INSERT OR UPDATE OR DELETE ON "quotation_attachments" FOR EACH ROW EXECUTE FUNCTION protect_quotation_child();
