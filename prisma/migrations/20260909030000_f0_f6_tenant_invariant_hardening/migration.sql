-- Follow-up hardening for the new employee financial foundation.
-- Composite keys ensure that an employee/profile can never be borrowed from
-- another tenant, even if an application-level check is accidentally omitted.
CREATE UNIQUE INDEX "users_companyId_id_key" ON "users" ("companyId", "id");
CREATE UNIQUE INDEX "employee_compensation_profiles_companyId_id_key"
  ON "employee_compensation_profiles" ("companyId", "id");
CREATE UNIQUE INDEX "employee_compensation_profiles_companyId_employeeId_id_key"
  ON "employee_compensation_profiles" ("companyId", "employeeId", "id");

ALTER TABLE "employee_compensation_profiles"
  DROP CONSTRAINT "employee_compensation_employee_fkey",
  ADD CONSTRAINT "employee_compensation_employee_tenant_fkey"
    FOREIGN KEY ("companyId", "employeeId") REFERENCES "users" ("companyId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_compensation_positive_amount_check" CHECK ("baseAmount" > 0),
  ADD CONSTRAINT "employee_compensation_date_range_check"
    CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" >= "effectiveFrom");

ALTER TABLE "employee_advances"
  DROP CONSTRAINT "employee_advances_employee_fkey",
  ADD CONSTRAINT "employee_advances_employee_tenant_fkey"
    FOREIGN KEY ("companyId", "employeeId") REFERENCES "users" ("companyId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_advances_positive_amount_check" CHECK ("amount" > 0);

ALTER TABLE "employee_reimbursements"
  DROP CONSTRAINT "employee_reimbursements_employee_fkey",
  ADD CONSTRAINT "employee_reimbursements_employee_tenant_fkey"
    FOREIGN KEY ("companyId", "employeeId") REFERENCES "users" ("companyId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_reimbursements_reviewer_tenant_fkey"
    FOREIGN KEY ("companyId", "reviewedByUserId") REFERENCES "users" ("companyId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_reimbursements_positive_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "employee_reimbursements_review_state_check" CHECK (
    ("reviewedByUserId" IS NULL AND "reviewedAt" IS NULL)
    OR ("reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL)
  );

ALTER TABLE "salary_history_links"
  DROP CONSTRAINT "salary_history_compensation_fkey",
  ADD CONSTRAINT "salary_history_employee_tenant_fkey"
    FOREIGN KEY ("companyId", "employeeId") REFERENCES "users" ("companyId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "salary_history_compensation_tenant_fkey"
    FOREIGN KEY ("companyId", "employeeId", "compensationProfileId")
    REFERENCES "employee_compensation_profiles" ("companyId", "employeeId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "salary_history_period_check" CHECK ("periodEnd" >= "periodStart");
