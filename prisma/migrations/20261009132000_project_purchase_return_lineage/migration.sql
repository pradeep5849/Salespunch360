-- Existing material and financial history remains unchanged. New supplier
-- returns carry explicit correction-document lineage and original unit cost.
ALTER TYPE "ProjectMaterialMovementType" ADD VALUE 'RETURN_TO_VENDOR';
ALTER TABLE "project_material_movements"
 ADD COLUMN "correctionDocumentId" UUID,
 ADD COLUMN "correctionLineId" UUID;
CREATE INDEX "project_material_movements_companyId_correctionDocumentId_corr_idx"
 ON "project_material_movements"("companyId","correctionDocumentId","correctionLineId");
ALTER TABLE "project_material_movements"
 ADD CONSTRAINT "project_material_correction_document_company_fk"
 FOREIGN KEY ("companyId","correctionDocumentId") REFERENCES "commercial_documents"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD CONSTRAINT "project_material_correction_line_company_fk"
 FOREIGN KEY ("companyId","correctionLineId") REFERENCES "commercial_document_lines"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT;
