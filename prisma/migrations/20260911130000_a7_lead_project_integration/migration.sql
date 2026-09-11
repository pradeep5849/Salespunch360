ALTER TABLE "projects" ADD COLUMN "sourceLeadId" UUID, ADD COLUMN "sourceQuotationId" UUID, ADD COLUMN "sourceSalesUserId" UUID, ADD COLUMN "sourceSalesManagerId" UUID;
CREATE UNIQUE INDEX "projects_companyId_sourceLeadId_key" ON "projects"("companyId","sourceLeadId");
CREATE UNIQUE INDEX "projects_companyId_sourceQuotationId_key" ON "projects"("companyId","sourceQuotationId");
ALTER TABLE "projects" ADD CONSTRAINT "projects_sourceLead_company_fkey" FOREIGN KEY ("companyId","sourceLeadId") REFERENCES "leads"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "projects" ADD CONSTRAINT "projects_sourceQuotation_company_fkey" FOREIGN KEY ("companyId","sourceQuotationId") REFERENCES "quotation_documents"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "projects" ADD CONSTRAINT "projects_sourceSalesUser_company_fkey" FOREIGN KEY ("companyId","sourceSalesUserId") REFERENCES "users"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "projects" ADD CONSTRAINT "projects_sourceSalesManager_company_fkey" FOREIGN KEY ("companyId","sourceSalesManagerId") REFERENCES "users"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT;
