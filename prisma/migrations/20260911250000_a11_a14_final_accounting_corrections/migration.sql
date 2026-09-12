-- Additive correction fields; existing documents continue through runtime fallbacks.
ALTER TABLE "commercial_documents" ADD COLUMN "payableAmount" DECIMAL(18,2);
ALTER TABLE "commercial_document_lines" ADD COLUMN "sourceCommercialLineId" UUID;
ALTER TABLE "commercial_document_lines" ADD CONSTRAINT "commercial_line_source_line_company_fk" FOREIGN KEY ("companyId","sourceCommercialLineId") REFERENCES "commercial_document_lines"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "commercial_line_source_line_idx" ON "commercial_document_lines"("companyId","sourceCommercialLineId");
CREATE INDEX "commercial_documents_aging_idx" ON "commercial_documents"("companyId","type","status","issueDate","branchId");
