-- Appending supporting files is nonfinancial; original records remain immutable.
-- Every posted append must have a complete, immutable, retry-addressable audit.
CREATE UNIQUE INDEX "sale_attachment_append_request_key"
ON "account_operational_audits" ("companyId", lower("metadata"->>'requestKey'))
WHERE "eventType"='SALE_ATTACHMENTS_ADDED';

ALTER TABLE "account_operational_audits" ADD CONSTRAINT "sale_attachment_append_metadata"
CHECK ("eventType" <> 'SALE_ATTACHMENTS_ADDED' OR COALESCE(
  "entityType"='SALES_INVOICE' AND
  ("metadata"->>'requestKey') ~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$' AND
  ("metadata"->>'requestHash') ~ '^[a-f0-9]{64}$' AND
  CASE WHEN jsonb_typeof("metadata"->'files')='array'
    THEN jsonb_array_length("metadata"->'files') BETWEEN 1 AND 50 ELSE false END,
  false));

CREATE FUNCTION protect_sale_attachment_append_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND current_setting('app.account_cleanup_company_id',true)=OLD."companyId"::text THEN RETURN OLD; END IF;
  IF OLD."eventType"='SALE_ATTACHMENTS_ADDED' THEN RAISE EXCEPTION 'SALE_ATTACHMENT_AUDIT_IMMUTABLE'; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW."eventType"='SALE_ATTACHMENTS_ADDED' THEN RAISE EXCEPTION 'SALE_ATTACHMENT_AUDIT_IMMUTABLE'; END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER "sale_attachment_append_audit_immutable"
BEFORE UPDATE OR DELETE ON "account_operational_audits"
FOR EACH ROW EXECUTE FUNCTION protect_sale_attachment_append_audit();

CREATE OR REPLACE FUNCTION guard_commercial_attachment_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status "CommercialDocumentStatus"; parent_type "CommercialDocumentType";
BEGIN
  IF TG_OP='DELETE' AND current_setting('app.account_cleanup_company_id',true)=OLD."companyId"::text THEN RETURN OLD; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'COMMERCIAL_ATTACHMENT_HISTORY_IMMUTABLE'; END IF;
  SELECT "status","type" INTO parent_status,parent_type FROM "commercial_documents"
    WHERE "companyId"=NEW."companyId" AND "id"=NEW."documentId" FOR UPDATE;
  IF parent_type IS DISTINCT FROM 'SALES_INVOICE'::"CommercialDocumentType" THEN RAISE EXCEPTION 'COMMERCIAL_ATTACHMENT_SAVE_REQUIRED'; END IF;
  IF parent_status='DRAFT'::"CommercialDocumentStatus" THEN RETURN NEW; END IF;
  IF parent_status='POSTED'::"CommercialDocumentStatus" AND EXISTS (
    SELECT 1 FROM "account_operational_audits" a WHERE a."companyId"=NEW."companyId"
      AND a."entityId"=NEW."documentId" AND a."entityType"='SALES_INVOICE'
      AND a."eventType"='SALE_ATTACHMENTS_ADDED' AND a."actorUserId"=NEW."uploadedById"
      AND a."metadata"->'files' @> jsonb_build_array(jsonb_build_object(
        'id',NEW."id"::text,'position',NEW."position",'displayName',NEW."displayName",
        'mimeType',NEW."mimeType",'sizeBytes',NEW."sizeBytes",'contentHash',NEW."contentHash"))
  ) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'COMMERCIAL_ATTACHMENT_SAVE_REQUIRED';
END $$;

CREATE FUNCTION check_sale_attachment_append_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE stored_count integer;
BEGIN
  IF NEW."eventType"<>'SALE_ATTACHMENTS_ADDED' THEN RETURN NEW; END IF;
  SELECT count(*) INTO stored_count FROM "commercial_attachments" c
  WHERE c."companyId"=NEW."companyId" AND c."documentId"=NEW."entityId" AND c."uploadedById"=NEW."actorUserId"
    AND NEW."metadata"->'files' @> jsonb_build_array(jsonb_build_object(
      'id',c."id"::text,'position',c."position",'displayName',c."displayName",
      'mimeType',c."mimeType",'sizeBytes',c."sizeBytes",'contentHash',c."contentHash"));
  IF stored_count<>jsonb_array_length(NEW."metadata"->'files') THEN RAISE EXCEPTION 'SALE_ATTACHMENT_APPEND_INCOMPLETE'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "sale_attachment_append_complete"
AFTER INSERT ON "account_operational_audits" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_sale_attachment_append_complete();
