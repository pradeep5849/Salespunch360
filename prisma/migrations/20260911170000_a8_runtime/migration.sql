ALTER TYPE "ProjectAuditEventType" ADD VALUE 'CHANGE_ORDER_CREATED';
ALTER TYPE "ProjectAuditEventType" ADD VALUE 'CHANGE_ORDER_SUBMITTED';
ALTER TYPE "ProjectAuditEventType" ADD VALUE 'CHANGE_ORDER_APPROVED';
ALTER TYPE "ProjectAuditEventType" ADD VALUE 'CHANGE_ORDER_REJECTED';
ALTER TYPE "ProjectAuditEventType" ADD VALUE 'CHANGE_ORDER_CANCELLED';
ALTER TABLE "commercial_documents" ADD COLUMN "sourcePurchaseOrderId" UUID;
CREATE INDEX "commercial_documents_companyId_sourcePurchaseOrderId_status_idx" ON "commercial_documents"("companyId","sourcePurchaseOrderId","status");
ALTER TABLE "commercial_documents" ADD CONSTRAINT "commercial_documents_sourcePurchaseOrder_company_fkey" FOREIGN KEY ("companyId","sourcePurchaseOrderId") REFERENCES "commercial_documents"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT;
