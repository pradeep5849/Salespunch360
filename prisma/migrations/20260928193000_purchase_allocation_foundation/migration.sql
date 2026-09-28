-- Additive purchase classification and allocation foundation; legacy OFFICE/PROJECT values remain valid.
ALTER TYPE "PurchasePurpose" ADD VALUE IF NOT EXISTS 'INVENTORY_SALES';
ALTER TYPE "PurchasePurpose" ADD VALUE IF NOT EXISTS 'GENERAL_OFFICE';
ALTER TYPE "PurchasePurpose" ADD VALUE IF NOT EXISTS 'FIXED_ASSET';
ALTER TYPE "PurchasePurpose" ADD VALUE IF NOT EXISTS 'MIXED';
CREATE TYPE "MaterialTreatment" AS ENUM ('DIRECT_TO_PROJECT', 'RECEIVE_IN_INVENTORY');
CREATE TYPE "PurchaseAllocationType" AS ENUM ('INVENTORY', 'PROJECT', 'GENERAL_EXPENSE', 'FIXED_ASSET');
ALTER TABLE "commercial_documents" ADD COLUMN "materialTreatment" "MaterialTreatment", ADD COLUMN "projectBudgetLineId" UUID;
CREATE TABLE "purchase_line_allocations" (
 "id" UUID NOT NULL, "companyId" UUID NOT NULL, "documentLineId" UUID NOT NULL,
 "allocationType" "PurchaseAllocationType" NOT NULL, "projectId" UUID, "projectBudgetLineId" UUID,
 "warehouseId" UUID, "materialTreatment" "MaterialTreatment", "quantity" DECIMAL(18,4) NOT NULL,
 "baseAmount" DECIMAL(18,2) NOT NULL, "discountAmount" DECIMAL(18,2) NOT NULL,
 "taxableAmount" DECIMAL(18,2) NOT NULL, "taxAmount" DECIMAL(18,2) NOT NULL,
 "cessAmount" DECIMAL(18,2) NOT NULL, "totalAmount" DECIMAL(18,2) NOT NULL,
 "position" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "purchase_line_allocations_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "purchase_line_allocations_documentLine_fkey" FOREIGN KEY ("companyId","documentLineId") REFERENCES "commercial_document_lines"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "purchase_line_allocations_companyId_id_key" ON "purchase_line_allocations"("companyId","id");
CREATE UNIQUE INDEX "purchase_line_allocations_companyId_documentLineId_position_key" ON "purchase_line_allocations"("companyId","documentLineId","position");
CREATE INDEX "purchase_line_allocations_companyId_projectId_idx" ON "purchase_line_allocations"("companyId","projectId");
