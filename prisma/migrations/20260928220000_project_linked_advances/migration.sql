ALTER TABLE "account_settlements" ADD COLUMN "projectId" UUID;
ALTER TABLE "advance_applications" ADD COLUMN "projectId" UUID;
ALTER TABLE "account_settlements" ADD CONSTRAINT "account_settlements_project_fk" FOREIGN KEY ("companyId","projectId") REFERENCES "projects"("companyId","id") ON DELETE RESTRICT;
ALTER TABLE "advance_applications" ADD CONSTRAINT "advance_applications_project_fk" FOREIGN KEY ("companyId","projectId") REFERENCES "projects"("companyId","id") ON DELETE RESTRICT;
CREATE INDEX "account_settlements_project_idx" ON "account_settlements"("companyId","projectId","transactionDate");
CREATE INDEX "advance_applications_project_idx" ON "advance_applications"("companyId","projectId","applicationDate");
