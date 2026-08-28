-- Existing users remain active. Optional profile fields preserve all Stage 1/2 records.
ALTER TABLE "users"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "employeeCode" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "users_companyId_isActive_role_idx"
  ON "users"("companyId", "isActive", "role");

CREATE UNIQUE INDEX "users_companyId_employeeCode_key"
  ON "users"("companyId", "employeeCode");

ALTER TABLE "users" ADD CONSTRAINT "users_employee_code_not_blank_check"
  CHECK ("employeeCode" IS NULL OR length("employeeCode") > 0);
