BEGIN;
-- Add tenant constraints without rewriting immutable historical material rows.
CREATE UNIQUE INDEX "project_material_movements_companyId_id_key" ON "project_material_movements"("companyId","id");
CREATE UNIQUE INDEX "project_budget_lines_companyId_id_key" ON "project_budget_lines"("companyId","id");
CREATE INDEX "project_material_movements_companyId_projectId_movementDate_cre_idx" ON "project_material_movements"("companyId","projectId","movementDate","createdAt","id");
CREATE INDEX "project_material_movements_companyId_projectId_sourceMovement_idx" ON "project_material_movements"("companyId","projectId","sourceMovementId");
ALTER TABLE "project_material_movements"
 ADD CONSTRAINT "project_material_project_company_fk" FOREIGN KEY ("companyId","projectId") REFERENCES "projects"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID,
 ADD CONSTRAINT "project_material_branch_company_fk" FOREIGN KEY ("companyId","branchId") REFERENCES "branches"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID,
 ADD CONSTRAINT "project_material_product_company_fk" FOREIGN KEY ("companyId","productId") REFERENCES "account_products"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID,
 ADD CONSTRAINT "project_material_warehouse_company_fk" FOREIGN KEY ("companyId","warehouseId") REFERENCES "warehouses"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID,
 ADD CONSTRAINT "project_material_creator_company_fk" FOREIGN KEY ("companyId","createdById") REFERENCES "users"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID,
 ADD CONSTRAINT "project_material_budget_company_fk" FOREIGN KEY ("companyId","projectBudgetLineId") REFERENCES "project_budget_lines"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID,
 ADD CONSTRAINT "project_material_source_project_company_fk" FOREIGN KEY ("companyId","sourceProjectId") REFERENCES "projects"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID,
 ADD CONSTRAINT "project_material_destination_project_company_fk" FOREIGN KEY ("companyId","destinationProjectId") REFERENCES "projects"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID,
 ADD CONSTRAINT "project_material_source_movement_company_fk" FOREIGN KEY ("companyId","sourceMovementId") REFERENCES "project_material_movements"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID,
 ADD CONSTRAINT "project_material_reversal_company_fk" FOREIGN KEY ("companyId","reversalOfId") REFERENCES "project_material_movements"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
-- Validate clean histories. Any legacy orphan stays unchanged and is explicitly
-- reported as NOT VALID; these constraints still protect every new row.
DO $$ DECLARE constraint_name text; BEGIN
 FOR constraint_name IN SELECT conname FROM pg_constraint WHERE conrelid='project_material_movements'::regclass AND NOT convalidated LOOP
  BEGIN EXECUTE format('ALTER TABLE project_material_movements VALIDATE CONSTRAINT %I',constraint_name);
  EXCEPTION WHEN foreign_key_violation OR check_violation THEN
   RAISE NOTICE 'Historical Project material integrity requires review: % remains NOT VALID', constraint_name;
  END;
 END LOOP;
END $$;
CREATE FUNCTION check_project_material_insert_scope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM "projects" p WHERE p."companyId"=NEW."companyId" AND p."id"=NEW."projectId" AND p."branchId"=NEW."branchId") THEN
  RAISE EXCEPTION 'PROJECT_MATERIAL_BRANCH_MISMATCH';
 END IF;
 IF NEW."projectBudgetLineId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "project_budget_lines" b WHERE b."companyId"=NEW."companyId" AND b."id"=NEW."projectBudgetLineId" AND b."projectId"=NEW."projectId") THEN
  RAISE EXCEPTION 'PROJECT_MATERIAL_BUDGET_MISMATCH';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER project_material_insert_scope BEFORE INSERT ON "project_material_movements" FOR EACH ROW EXECUTE FUNCTION check_project_material_insert_scope();

COMMIT;
