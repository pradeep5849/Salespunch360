-- Nullable additive links preserve all existing documents. Closure records the
-- first actual Sale posting / Sales Order confirmation, never a prefill read.
ALTER TYPE "QuotationAuditEventType" ADD VALUE 'CONVERTED';
ALTER TABLE commercial_documents ADD COLUMN "sourceQuotationRevisionId" UUID;
ALTER TABLE quotation_documents ADD COLUMN "convertedCommercialDocumentId" UUID, ADD COLUMN "convertedAt" TIMESTAMP(3);
CREATE INDEX "commercial_documents_companyId_sourceQuotationRevisionId_idx" ON commercial_documents("companyId","sourceQuotationRevisionId");
CREATE UNIQUE INDEX "quotation_documents_companyId_convertedCommercialDocumentId_key" ON quotation_documents("companyId","convertedCommercialDocumentId");
ALTER TABLE commercial_documents ADD CONSTRAINT "commercial_documents_sourceQuotationRevision_fkey" FOREIGN KEY ("companyId","sourceQuotationRevisionId") REFERENCES quotation_revisions("companyId",id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE quotation_documents ADD CONSTRAINT "quotation_documents_convertedCommercialDocument_fkey" FOREIGN KEY ("companyId","convertedCommercialDocumentId") REFERENCES commercial_documents("companyId",id) ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE quotation_documents ADD CONSTRAINT "quotation_conversion_closure_pair" CHECK (("convertedCommercialDocumentId" IS NULL)=("convertedAt" IS NULL));

CREATE FUNCTION protect_commercial_quotation_source() RETURNS trigger AS $$
DECLARE source RECORD;
BEGIN
 IF TG_OP='UPDATE' AND NEW."sourceQuotationRevisionId" IS DISTINCT FROM OLD."sourceQuotationRevisionId" THEN RAISE EXCEPTION 'QUOTATION_CONVERSION_SOURCE_IMMUTABLE'; END IF;
 IF NEW."sourceQuotationRevisionId" IS NULL THEN RETURN NEW; END IF;
 IF NEW.type NOT IN ('SALES_INVOICE','SALES_ORDER') THEN RAISE EXCEPTION 'INVALID_QUOTATION_CONVERSION_TARGET'; END IF;
 SELECT r.status AS revision_status,r."revisionNumber",q.id,q.status,q."currentRevisionNumber",q."branchId",q."customerId",q."projectId",q."convertedCommercialDocumentId" INTO source
 FROM quotation_revisions r JOIN quotation_documents q ON q.id=r."documentId" AND q."companyId"=r."companyId"
 WHERE r.id=NEW."sourceQuotationRevisionId" AND r."companyId"=NEW."companyId" FOR UPDATE OF q;
 IF NOT FOUND OR source."branchId" IS DISTINCT FROM NEW."branchId" OR source."customerId" IS DISTINCT FROM NEW."customerId" OR source."projectId" IS DISTINCT FROM NEW."projectId" THEN RAISE EXCEPTION 'INVALID_QUOTATION_CONVERSION_SOURCE'; END IF;
 IF TG_OP='INSERT' OR (NEW.status='POSTED' AND OLD.status='DRAFT') THEN
  IF source."convertedCommercialDocumentId" IS NOT NULL THEN RAISE EXCEPTION 'QUOTATION_ALREADY_CONVERTED'; END IF;
  IF source.status<>'APPROVED' OR source.revision_status<>'APPROVED' THEN RAISE EXCEPTION 'QUOTATION_APPROVAL_REQUIRED'; END IF;
  IF source."revisionNumber"<>source."currentRevisionNumber" THEN RAISE EXCEPTION 'QUOTATION_REVISION_CHANGED'; END IF;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER commercial_quotation_source BEFORE INSERT OR UPDATE ON commercial_documents FOR EACH ROW EXECUTE FUNCTION protect_commercial_quotation_source();

CREATE FUNCTION protect_quotation_conversion_closure() RETURNS trigger AS $$
DECLARE target RECORD;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD."convertedCommercialDocumentId" IS NOT NULL AND current_setting('app.account_cleanup_company_id',true) IS DISTINCT FROM OLD."companyId"::text THEN RAISE EXCEPTION 'QUOTATION_CONVERSION_HISTORY_IMMUTABLE'; END IF;
  RETURN OLD;
 END IF;
 IF OLD."convertedCommercialDocumentId" IS NOT NULL THEN
  IF NEW."convertedCommercialDocumentId" IS DISTINCT FROM OLD."convertedCommercialDocumentId" OR NEW."convertedAt" IS DISTINCT FROM OLD."convertedAt" OR NEW.status IS DISTINCT FROM OLD.status OR NEW."currentRevisionNumber" IS DISTINCT FROM OLD."currentRevisionNumber" OR NEW."companyId" IS DISTINCT FROM OLD."companyId" THEN RAISE EXCEPTION 'QUOTATION_CONVERSION_HISTORY_IMMUTABLE'; END IF;
  RETURN NEW;
 END IF;
 IF NEW."convertedCommercialDocumentId" IS NULL THEN RETURN NEW; END IF;
 SELECT d.status,d.type,d."branchId",d."customerId",d."projectId",r."documentId",r."revisionNumber",r.status AS revision_status INTO target
 FROM commercial_documents d JOIN quotation_revisions r ON r.id=d."sourceQuotationRevisionId" AND r."companyId"=d."companyId"
 WHERE d.id=NEW."convertedCommercialDocumentId" AND d."companyId"=NEW."companyId";
 IF NOT FOUND OR target.status<>'POSTED' OR target.type NOT IN ('SALES_INVOICE','SALES_ORDER') OR target."documentId"<>NEW.id OR target."revisionNumber"<>NEW."currentRevisionNumber" OR target.revision_status<>'APPROVED' OR NEW.status<>'APPROVED' OR target."branchId" IS DISTINCT FROM NEW."branchId" OR target."customerId" IS DISTINCT FROM NEW."customerId" OR target."projectId" IS DISTINCT FROM NEW."projectId" THEN RAISE EXCEPTION 'INVALID_QUOTATION_CONVERSION_CLOSURE'; END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER quotation_conversion_closure BEFORE UPDATE OR DELETE ON quotation_documents FOR EACH ROW EXECUTE FUNCTION protect_quotation_conversion_closure();

CREATE FUNCTION require_posted_quotation_closure() RETURNS trigger AS $$
BEGIN
 IF NEW."sourceQuotationRevisionId" IS NOT NULL AND NEW.status='POSTED' AND NOT EXISTS(
  SELECT 1 FROM quotation_revisions r JOIN quotation_documents q ON q.id=r."documentId" AND q."companyId"=r."companyId"
  WHERE r.id=NEW."sourceQuotationRevisionId" AND r."companyId"=NEW."companyId" AND q."convertedCommercialDocumentId"=NEW.id AND q."convertedAt" IS NOT NULL
 ) THEN RAISE EXCEPTION 'QUOTATION_CONVERSION_CLOSURE_REQUIRED'; END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER posted_quotation_closure AFTER INSERT OR UPDATE ON commercial_documents DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_posted_quotation_closure();
