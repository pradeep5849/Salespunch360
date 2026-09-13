-- R2: compound indexes for bounded high-volume tenant/branch history queries.
CREATE INDEX "attendances_companyId_branchId_userId_startedAt_idx"
  ON "attendances"("companyId", "branchId", "userId", "startedAt");
CREATE INDEX "customer_visits_companyId_branchId_userId_checkedInAt_idx"
  ON "customer_visits"("companyId", "branchId", "userId", "checkedInAt");
CREATE INDEX "location_points_companyId_branchId_userId_capturedAt_idx"
  ON "location_points"("companyId", "branchId", "userId", "capturedAt");
CREATE INDEX "commercial_documents_companyId_branchId_status_type_issueDate_idx"
  ON "commercial_documents"("companyId", "branchId", "status", "type", "issueDate");
CREATE INDEX "projects_companyId_branchId_createdAt_idx"
  ON "projects"("companyId", "branchId", "createdAt");
