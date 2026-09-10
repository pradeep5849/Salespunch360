BEGIN;
-- CreateEnum
CREATE TYPE "QuotationDocumentType" AS ENUM ('QUOTATION', 'ESTIMATE', 'BOQ');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuotationLineType" AS ENUM ('PRODUCT', 'SERVICE', 'WORK_PACKAGE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "QuotationAdjustmentType" AS ENUM ('DISCOUNT', 'ADDITIONAL_CHARGE');

-- CreateEnum
CREATE TYPE "QuotationValueType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "QuotationAuditEventType" AS ENUM ('CREATED', 'REVISION_CREATED', 'SUBMITTED_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'SHARED', 'SENT', 'SHARE_REVOKED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "quotation_documents" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "documentType" "QuotationDocumentType" NOT NULL,
    "documentNumber" VARCHAR(80) NOT NULL,
    "customerId" UUID,
    "sourceLeadId" UUID,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "currentRevisionNumber" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "acceptedById" UUID,
    "acceptedAt" TIMESTAMP(3),
    "acceptanceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_revisions" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" DATE NOT NULL,
    "validUntil" DATE,
    "customerName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "billingAddress" TEXT,
    "siteAddress" TEXT,
    "gstin" VARCHAR(15),
    "pan" VARCHAR(10),
    "terms" TEXT,
    "inclusions" TEXT,
    "exclusions" TEXT,
    "notes" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "additionalChargeTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxableTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "internalCostTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expectedProfit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expectedMarginPercent" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_lines" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "lineType" "QuotationLineType" NOT NULL,
    "productId" UUID,
    "serviceId" UUID,
    "workPackageId" UUID,
    "unitId" UUID,
    "itemName" TEXT NOT NULL,
    "itemCode" TEXT,
    "description" TEXT,
    "specification" TEXT,
    "unitName" TEXT,
    "unitSymbol" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "rate" DECIMAL(18,2) NOT NULL,
    "discountType" "QuotationValueType",
    "discountValue" DECIMAL(18,4),
    "baseAmount" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL,
    "taxableAmount" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "internalUnitCost" DECIMAL(18,2) NOT NULL,
    "internalCostTotal" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "quotation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_adjustments" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "QuotationAdjustmentType" NOT NULL,
    "label" TEXT NOT NULL,
    "valueType" "QuotationValueType" NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "quotation_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_payment_schedules" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "valueType" "QuotationValueType" NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "dueDescription" TEXT,

    CONSTRAINT "quotation_payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_shares" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_audit_events" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "actorId" UUID,
    "eventType" "QuotationAuditEventType" NOT NULL,
    "revisionNumber" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotation_documents_companyId_branchId_status_idx" ON "quotation_documents"("companyId", "branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_documents_companyId_id_key" ON "quotation_documents"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_documents_companyId_branchId_documentType_documen_key" ON "quotation_documents"("companyId", "branchId", "documentType", "documentNumber");

-- CreateIndex
CREATE INDEX "quotation_revisions_companyId_documentId_idx" ON "quotation_revisions"("companyId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_revisions_companyId_id_key" ON "quotation_revisions"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_revisions_documentId_revisionNumber_key" ON "quotation_revisions"("documentId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_lines_companyId_id_key" ON "quotation_lines"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_lines_revisionId_position_key" ON "quotation_lines"("revisionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_adjustments_revisionId_position_key" ON "quotation_adjustments"("revisionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_payment_schedules_revisionId_position_key" ON "quotation_payment_schedules"("revisionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_shares_tokenHash_key" ON "quotation_shares"("tokenHash");

-- CreateIndex
CREATE INDEX "quotation_shares_companyId_revisionId_idx" ON "quotation_shares"("companyId", "revisionId");

-- CreateIndex
CREATE INDEX "quotation_audit_events_companyId_documentId_createdAt_idx" ON "quotation_audit_events"("companyId", "documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "customers_companyId_id_key" ON "customers"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_companyId_id_key" ON "leads"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "account_products_companyId_id_key" ON "account_products"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "account_services_companyId_id_key" ON "account_services"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "work_packages_companyId_id_key" ON "work_packages"("companyId", "id");

-- AddForeignKey
ALTER TABLE "quotation_documents" ADD CONSTRAINT "quotation_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_documents" ADD CONSTRAINT "quotation_documents_companyId_branchId_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_documents" ADD CONSTRAINT "quotation_documents_companyId_customerId_fkey" FOREIGN KEY ("companyId", "customerId") REFERENCES "customers"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_documents" ADD CONSTRAINT "quotation_documents_companyId_sourceLeadId_fkey" FOREIGN KEY ("companyId", "sourceLeadId") REFERENCES "leads"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_documents" ADD CONSTRAINT "quotation_documents_companyId_createdById_fkey" FOREIGN KEY ("companyId", "createdById") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_documents" ADD CONSTRAINT "quotation_documents_companyId_acceptedById_fkey" FOREIGN KEY ("companyId", "acceptedById") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_companyId_documentId_fkey" FOREIGN KEY ("companyId", "documentId") REFERENCES "quotation_documents"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_companyId_revisionId_fkey" FOREIGN KEY ("companyId", "revisionId") REFERENCES "quotation_revisions"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_companyId_productId_fkey" FOREIGN KEY ("companyId", "productId") REFERENCES "account_products"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_companyId_serviceId_fkey" FOREIGN KEY ("companyId", "serviceId") REFERENCES "account_services"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_companyId_workPackageId_fkey" FOREIGN KEY ("companyId", "workPackageId") REFERENCES "work_packages"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_companyId_unitId_fkey" FOREIGN KEY ("companyId", "unitId") REFERENCES "account_units"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_adjustments" ADD CONSTRAINT "quotation_adjustments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_adjustments" ADD CONSTRAINT "quotation_adjustments_companyId_revisionId_fkey" FOREIGN KEY ("companyId", "revisionId") REFERENCES "quotation_revisions"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_payment_schedules" ADD CONSTRAINT "quotation_payment_schedules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_payment_schedules" ADD CONSTRAINT "quotation_payment_schedules_companyId_revisionId_fkey" FOREIGN KEY ("companyId", "revisionId") REFERENCES "quotation_revisions"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_shares" ADD CONSTRAINT "quotation_shares_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_shares" ADD CONSTRAINT "quotation_shares_companyId_revisionId_fkey" FOREIGN KEY ("companyId", "revisionId") REFERENCES "quotation_revisions"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_audit_events" ADD CONSTRAINT "quotation_audit_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_audit_events" ADD CONSTRAINT "quotation_audit_events_companyId_documentId_fkey" FOREIGN KEY ("companyId", "documentId") REFERENCES "quotation_documents"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "quotation_audit_events" ADD CONSTRAINT "quotation_audit_events_companyId_actorId_fkey" FOREIGN KEY ("companyId", "actorId") REFERENCES "users"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


ALTER TABLE "quotation_documents" ADD CONSTRAINT "quotation_documents_exactly_one_source_check"
  CHECK (("customerId" IS NOT NULL)::int + ("sourceLeadId" IS NOT NULL)::int = 1);

ALTER TABLE "quotation_lines" ADD CONSTRAINT "quotation_lines_source_consistency_check" CHECK (
  ("lineType"='PRODUCT' AND "productId" IS NOT NULL AND "serviceId" IS NULL AND "workPackageId" IS NULL) OR
  ("lineType"='SERVICE' AND "productId" IS NULL AND "serviceId" IS NOT NULL AND "workPackageId" IS NULL) OR
  ("lineType"='WORK_PACKAGE' AND "productId" IS NULL AND "serviceId" IS NULL AND "workPackageId" IS NOT NULL) OR
  ("lineType"='CUSTOM' AND "productId" IS NULL AND "serviceId" IS NULL AND "workPackageId" IS NULL)
);

-- Drafts are mutable; pending/issued commercial snapshots are immutable. Cleanup bypass is tenant-exact.
CREATE FUNCTION protect_quotation_revision() RETURNS trigger AS $$
DECLARE cleanup_company text := current_setting('app.account_cleanup_company_id', true);
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF cleanup_company = OLD."companyId"::text OR OLD.status = 'DRAFT' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'QUOTATION_REVISION_IMMUTABLE';
  END IF;
  IF OLD."companyId" <> NEW."companyId" OR OLD."documentId" <> NEW."documentId" OR OLD."revisionNumber" <> NEW."revisionNumber" THEN
    RAISE EXCEPTION 'QUOTATION_REVISION_IDENTITY_IMMUTABLE';
  END IF;
  IF OLD.status <> 'DRAFT' AND (to_jsonb(OLD) - 'status' - 'updatedAt') IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'updatedAt') THEN
    RAISE EXCEPTION 'QUOTATION_REVISION_COMMERCIAL_IMMUTABLE';
  END IF;
  IF OLD.status <> NEW.status AND NOT (
    (OLD.status='DRAFT' AND NEW.status IN ('PENDING_APPROVAL','CANCELLED')) OR
    (OLD.status='PENDING_APPROVAL' AND NEW.status IN ('APPROVED','REJECTED','CANCELLED')) OR
    (OLD.status='APPROVED' AND NEW.status IN ('SENT','ACCEPTED','DECLINED','CANCELLED')) OR
    (OLD.status='SENT' AND NEW.status IN ('ACCEPTED','DECLINED','EXPIRED','CANCELLED'))
  ) THEN RAISE EXCEPTION 'INVALID_QUOTATION_REVISION_TRANSITION'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER quotation_revision_immutable BEFORE UPDATE OR DELETE ON "quotation_revisions" FOR EACH ROW EXECUTE FUNCTION protect_quotation_revision();

-- Check OLD and NEW parents independently so children cannot move across status or tenant boundaries.
CREATE FUNCTION protect_quotation_child() RETURNS trigger AS $$
DECLARE old_status "QuotationStatus"; new_status "QuotationStatus"; old_company uuid; new_company uuid;
DECLARE cleanup_company text := current_setting('app.account_cleanup_company_id', true);
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT status, "companyId" INTO old_status, old_company FROM "quotation_revisions" WHERE id=OLD."revisionId";
    IF old_status IS NULL OR old_company <> OLD."companyId" THEN RAISE EXCEPTION 'INVALID_OLD_QUOTATION_PARENT'; END IF;
    IF TG_OP='DELETE' AND cleanup_company = OLD."companyId"::text THEN RETURN OLD; END IF;
    IF old_status <> 'DRAFT' THEN RAISE EXCEPTION 'ISSUED_QUOTATION_CHILD_IMMUTABLE'; END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  END IF;
  SELECT status, "companyId" INTO new_status, new_company FROM "quotation_revisions" WHERE id=NEW."revisionId";
  IF new_status IS NULL OR new_company <> NEW."companyId" OR (TG_OP='UPDATE' AND OLD."companyId" <> NEW."companyId") THEN
    RAISE EXCEPTION 'INVALID_NEW_QUOTATION_PARENT';
  END IF;
  IF new_status <> 'DRAFT' THEN RAISE EXCEPTION 'ISSUED_QUOTATION_CHILD_IMMUTABLE'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER quotation_line_immutable BEFORE INSERT OR UPDATE OR DELETE ON "quotation_lines" FOR EACH ROW EXECUTE FUNCTION protect_quotation_child();
CREATE TRIGGER quotation_adjustment_immutable BEFORE INSERT OR UPDATE OR DELETE ON "quotation_adjustments" FOR EACH ROW EXECUTE FUNCTION protect_quotation_child();
CREATE TRIGGER quotation_schedule_immutable BEFORE INSERT OR UPDATE OR DELETE ON "quotation_payment_schedules" FOR EACH ROW EXECUTE FUNCTION protect_quotation_child();

CREATE FUNCTION protect_quotation_document_lifecycle() RETURNS trigger AS $$
DECLARE target_exists boolean;
BEGIN
  IF NEW."currentRevisionNumber" < OLD."currentRevisionNumber" THEN RAISE EXCEPTION 'QUOTATION_CURRENT_REVISION_CANNOT_DECREASE'; END IF;
  IF NEW."currentRevisionNumber" <> OLD."currentRevisionNumber" THEN
    IF NOT (NEW.status='DRAFT' AND OLD.status IN ('APPROVED','REJECTED','SENT','DECLINED','EXPIRED') AND NEW."currentRevisionNumber"=OLD."currentRevisionNumber"+1) THEN
      RAISE EXCEPTION 'INVALID_QUOTATION_CURRENT_REVISION_CHANGE';
    END IF;
    SELECT EXISTS(SELECT 1 FROM "quotation_revisions" r WHERE r."companyId"=NEW."companyId" AND r."documentId"=NEW.id AND r."revisionNumber"=NEW."currentRevisionNumber") INTO target_exists;
    IF NOT target_exists THEN RAISE EXCEPTION 'QUOTATION_CURRENT_REVISION_NOT_FOUND'; END IF;
  END IF;
  IF OLD.status <> NEW.status AND NOT (
    (OLD.status='DRAFT' AND NEW.status IN ('PENDING_APPROVAL','CANCELLED')) OR
    (OLD.status='PENDING_APPROVAL' AND NEW.status IN ('APPROVED','REJECTED','CANCELLED')) OR
    (OLD.status='APPROVED' AND NEW.status IN ('SENT','ACCEPTED','DECLINED','CANCELLED')) OR
    (OLD.status='SENT' AND NEW.status IN ('ACCEPTED','DECLINED','EXPIRED','CANCELLED')) OR
    (NEW.status='DRAFT' AND NEW."currentRevisionNumber"=OLD."currentRevisionNumber"+1 AND OLD.status IN ('APPROVED','REJECTED','SENT','DECLINED','EXPIRED'))
  ) THEN RAISE EXCEPTION 'INVALID_QUOTATION_DOCUMENT_TRANSITION'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER quotation_document_lifecycle BEFORE UPDATE OF status, "currentRevisionNumber" ON "quotation_documents" FOR EACH ROW EXECUTE FUNCTION protect_quotation_document_lifecycle();

CREATE FUNCTION prevent_quotation_audit_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.account_cleanup_company_id', true) = OLD."companyId"::text THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'QUOTATION_AUDIT_APPEND_ONLY';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER quotation_audit_append_only BEFORE UPDATE OR DELETE ON "quotation_audit_events" FOR EACH ROW EXECUTE FUNCTION prevent_quotation_audit_mutation();

COMMIT;
