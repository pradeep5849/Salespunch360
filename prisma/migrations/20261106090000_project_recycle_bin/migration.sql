ALTER TABLE "projects" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "projects_companyId_archivedAt_idx" ON "projects"("companyId", "archivedAt");
