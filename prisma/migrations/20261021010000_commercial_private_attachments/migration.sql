CREATE TABLE "commercial_attachments" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "displayName" VARCHAR(240) NOT NULL,
  "mimeType" VARCHAR(120) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "contentHash" CHAR(64) NOT NULL,
  "storageKey" VARCHAR(512) NOT NULL,
  "uploadedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commercial_attachments_bounds" CHECK (
    "position" BETWEEN 0 AND 49 AND "sizeBytes" BETWEEN 1 AND 10485760
    AND "mimeType" IN ('application/pdf','image/png','image/jpeg')
    AND "contentHash" ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT "commercial_attachments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "commercial_attachments_companyId_documentId_fkey" FOREIGN KEY ("companyId","documentId") REFERENCES "commercial_documents"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "commercial_attachments_companyId_uploadedById_fkey" FOREIGN KEY ("companyId","uploadedById") REFERENCES "users"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "commercial_attachments_companyId_documentId_position_key" ON "commercial_attachments"("companyId","documentId","position");
CREATE INDEX "commercial_attachments_companyId_storageKey_idx" ON "commercial_attachments"("companyId","storageKey");

CREATE FUNCTION guard_commercial_attachment_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status "CommercialDocumentStatus"; parent_type "CommercialDocumentType";
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.account_cleanup_company_id',true) = OLD."companyId"::text THEN RETURN OLD; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'COMMERCIAL_ATTACHMENT_HISTORY_IMMUTABLE'; END IF;
  SELECT "status","type" INTO parent_status,parent_type FROM "commercial_documents"
    WHERE "companyId"=NEW."companyId" AND "id"=NEW."documentId" FOR UPDATE;
  IF parent_status IS DISTINCT FROM 'DRAFT'::"CommercialDocumentStatus" OR parent_type IS DISTINCT FROM 'SALES_INVOICE'::"CommercialDocumentType" THEN
    RAISE EXCEPTION 'COMMERCIAL_ATTACHMENT_SAVE_REQUIRED';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "commercial_attachment_history_guard" BEFORE INSERT OR UPDATE OR DELETE ON "commercial_attachments"
FOR EACH ROW EXECUTE FUNCTION guard_commercial_attachment_history();
