CREATE TYPE "ProjectMaterialMovementType" AS ENUM ('DIRECT_PROJECT_RECEIPT','INVENTORY_ISSUE_TO_PROJECT','CONSUMPTION','RETURN_TO_INVENTORY','TRANSFER_OUT','TRANSFER_IN','REVERSAL');
CREATE TABLE "project_material_movements" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "companyId" UUID NOT NULL, "branchId" UUID NOT NULL, "projectId" UUID NOT NULL,
 "movementType" "ProjectMaterialMovementType" NOT NULL, "purchaseDocumentId" UUID, "purchaseLineId" UUID, "purchaseAllocationId" UUID,
 "productId" UUID NOT NULL, "warehouseId" UUID, "projectLocation" TEXT, "batchId" UUID, "serialNumberId" UUID,
 "quantity" DECIMAL(20,6) NOT NULL, "originalUnitCost" DECIMAL(20,6) NOT NULL, "totalCost" DECIMAL(20,2) NOT NULL,
 "movementDate" DATE NOT NULL, "sourceProjectId" UUID, "destinationProjectId" UUID, "projectBudgetLineId" UUID,
 "reason" TEXT, "notes" TEXT, "attachmentKey" TEXT, "createdById" UUID NOT NULL, "sourceMovementId" UUID, "reversalOfId" UUID,
 "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "project_material_movements_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "project_material_positive" CHECK ("quantity">0 AND "originalUnitCost">=0 AND "totalCost">=0),
 CONSTRAINT "project_material_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT,
 CONSTRAINT "project_material_branch_fk" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT,
 CONSTRAINT "project_material_project_fk" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT,
 CONSTRAINT "project_material_product_fk" FOREIGN KEY ("productId") REFERENCES "account_products"("id") ON DELETE RESTRICT,
 CONSTRAINT "project_material_creator_fk" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT,
 CONSTRAINT "project_material_source_fk" FOREIGN KEY ("sourceMovementId") REFERENCES "project_material_movements"("id") ON DELETE RESTRICT,
 CONSTRAINT "project_material_reversal_fk" FOREIGN KEY ("reversalOfId") REFERENCES "project_material_movements"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "project_material_company_idempotency_key" ON "project_material_movements"("companyId","idempotencyKey");
CREATE UNIQUE INDEX "project_material_reversal_once" ON "project_material_movements"("reversalOfId");
CREATE INDEX "project_material_balance_idx" ON "project_material_movements"("companyId","branchId","projectId","productId","movementDate");
CREATE INDEX "project_material_lineage_idx" ON "project_material_movements"("companyId","purchaseAllocationId","projectId");
-- Project material is append-only; corrections use REVERSAL rows.
CREATE FUNCTION prevent_project_material_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PROJECT_MATERIAL_IMMUTABLE'; END $$;
CREATE TRIGGER project_material_no_update_delete BEFORE UPDATE OR DELETE ON "project_material_movements" FOR EACH ROW EXECUTE FUNCTION prevent_project_material_mutation();
