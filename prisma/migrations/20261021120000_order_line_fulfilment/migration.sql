-- Explicit provenance only. Historical bills remain unallocated; no item-name/amount guessing.
ALTER TABLE commercial_documents ADD COLUMN "sourceSalesOrderId" UUID;
ALTER TABLE commercial_document_lines ADD COLUMN "sourceOrderLineId" UUID;
CREATE INDEX "commercial_documents_companyId_sourceSalesOrderId_status_idx" ON commercial_documents("companyId","sourceSalesOrderId",status);
ALTER TABLE commercial_documents ADD CONSTRAINT "commercial_documents_companyId_sourceSalesOrderId_fkey" FOREIGN KEY ("companyId","sourceSalesOrderId") REFERENCES commercial_documents("companyId",id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE commercial_document_lines ADD CONSTRAINT "commercial_document_lines_companyId_sourceOrderLineId_fkey" FOREIGN KEY ("companyId","sourceOrderLineId") REFERENCES commercial_document_lines("companyId",id) ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION protect_order_source_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status<>'DRAFT' AND NEW."sourceSalesOrderId" IS DISTINCT FROM OLD."sourceSalesOrderId" THEN
  RAISE EXCEPTION 'FINANCIAL_HISTORY_IMMUTABLE';
 END IF;
 IF NEW."sourceSalesOrderId" IS NOT NULL AND (NEW.type<>'SALES_INVOICE' OR NEW."sourcePurchaseOrderId" IS NOT NULL) THEN
  RAISE EXCEPTION 'INVALID_ORDER_TARGET_TYPE';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_source_identity BEFORE INSERT OR UPDATE ON commercial_documents FOR EACH ROW EXECUTE FUNCTION protect_order_source_identity();

CREATE FUNCTION protect_order_line_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target commercial_documents%ROWTYPE; source_order_id uuid;
BEGIN
 IF NEW."sourceOrderLineId" IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO target FROM commercial_documents WHERE id=NEW."documentId" AND "companyId"=NEW."companyId";
 source_order_id=COALESCE(target."sourceSalesOrderId",target."sourcePurchaseOrderId");
 IF source_order_id IS NULL OR target.type NOT IN ('SALES_INVOICE','PURCHASE_BILL') OR NOT EXISTS(
  SELECT 1 FROM commercial_document_lines l WHERE l.id=NEW."sourceOrderLineId" AND l."companyId"=NEW."companyId" AND l."documentId"=source_order_id
 ) THEN RAISE EXCEPTION 'INVALID_SOURCE_ORDER_LINE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_line_source BEFORE INSERT OR UPDATE ON commercial_document_lines FOR EACH ROW EXECUTE FUNCTION protect_order_line_source();
