-- F0-F6 additive closure. No operational row is deleted or recreated.
CREATE TYPE "CompensationStatus" AS ENUM ('ACTIVE','SUPERSEDED','CANCELLED');
CREATE TYPE "EmployeeFinancialRequestStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');
CREATE UNIQUE INDEX "branches_one_primary_per_company" ON "branches" ("companyId") WHERE "isPrimary" = true;
CREATE UNIQUE INDEX "branches_company_id_id_key" ON "branches" ("companyId", "id");

ALTER TABLE "attendances" ADD COLUMN "branchId" UUID;
ALTER TABLE "location_points" ADD COLUMN "branchId" UUID;
ALTER TABLE "customers" ADD COLUMN "branchId" UUID;
ALTER TABLE "customer_visits" ADD COLUMN "branchId" UUID;
ALTER TABLE "leads" ADD COLUMN "branchId" UUID;
ALTER TABLE "follow_up_tasks" ADD COLUMN "branchId" UUID;
ALTER TABLE "sales_targets" ADD COLUMN "branchId" UUID;
ALTER TABLE "daily_travel_approvals" ADD COLUMN "branchId" UUID;
ALTER TABLE "geofence_events" ADD COLUMN "branchId" UUID;

-- Deterministic tenant-local backfill to the one Primary Head Office.
UPDATE "attendances" AS record SET "branchId" = branch."id" FROM "branches" AS branch WHERE branch."companyId" = record."companyId" AND branch."isPrimary" = true AND record."branchId" IS NULL;
UPDATE "location_points" AS record SET "branchId" = branch."id" FROM "branches" AS branch WHERE branch."companyId" = record."companyId" AND branch."isPrimary" = true AND record."branchId" IS NULL;
UPDATE "customers" AS record SET "branchId" = branch."id" FROM "branches" AS branch WHERE branch."companyId" = record."companyId" AND branch."isPrimary" = true AND record."branchId" IS NULL;
UPDATE "customer_visits" AS record SET "branchId" = branch."id" FROM "branches" AS branch WHERE branch."companyId" = record."companyId" AND branch."isPrimary" = true AND record."branchId" IS NULL;
UPDATE "leads" AS record SET "branchId" = branch."id" FROM "branches" AS branch WHERE branch."companyId" = record."companyId" AND branch."isPrimary" = true AND record."branchId" IS NULL;
UPDATE "follow_up_tasks" AS record SET "branchId" = branch."id" FROM "branches" AS branch WHERE branch."companyId" = record."companyId" AND branch."isPrimary" = true AND record."branchId" IS NULL;
UPDATE "sales_targets" AS record SET "branchId" = branch."id" FROM "branches" AS branch WHERE branch."companyId" = record."companyId" AND branch."isPrimary" = true AND record."branchId" IS NULL;
UPDATE "daily_travel_approvals" AS record SET "branchId" = branch."id" FROM "branches" AS branch WHERE branch."companyId" = record."companyId" AND branch."isPrimary" = true AND record."branchId" IS NULL;
UPDATE "geofence_events" AS record SET "branchId" = branch."id" FROM "branches" AS branch WHERE branch."companyId" = record."companyId" AND branch."isPrimary" = true AND record."branchId" IS NULL;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM "attendances" WHERE "branchId" IS NULL) THEN RAISE EXCEPTION 'F5 backfill failed: attendances has records without a Primary Branch'; END IF; END $$;
ALTER TABLE "attendances" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_company_branch_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "attendances_companyId_branchId_idx" ON "attendances"("companyId", "branchId");
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "location_points" WHERE "branchId" IS NULL) THEN RAISE EXCEPTION 'F5 backfill failed: location_points has records without a Primary Branch'; END IF; END $$;
ALTER TABLE "location_points" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "location_points" ADD CONSTRAINT "location_points_company_branch_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "location_points_companyId_branchId_idx" ON "location_points"("companyId", "branchId");
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "customers" WHERE "branchId" IS NULL) THEN RAISE EXCEPTION 'F5 backfill failed: customers has records without a Primary Branch'; END IF; END $$;
ALTER TABLE "customers" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_branch_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "customers_companyId_branchId_idx" ON "customers"("companyId", "branchId");
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "customer_visits" WHERE "branchId" IS NULL) THEN RAISE EXCEPTION 'F5 backfill failed: customer_visits has records without a Primary Branch'; END IF; END $$;
ALTER TABLE "customer_visits" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "customer_visits" ADD CONSTRAINT "customer_visits_company_branch_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "customer_visits_companyId_branchId_idx" ON "customer_visits"("companyId", "branchId");
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "leads" WHERE "branchId" IS NULL) THEN RAISE EXCEPTION 'F5 backfill failed: leads has records without a Primary Branch'; END IF; END $$;
ALTER TABLE "leads" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_branch_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "leads_companyId_branchId_idx" ON "leads"("companyId", "branchId");
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "follow_up_tasks" WHERE "branchId" IS NULL) THEN RAISE EXCEPTION 'F5 backfill failed: follow_up_tasks has records without a Primary Branch'; END IF; END $$;
ALTER TABLE "follow_up_tasks" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_company_branch_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "follow_up_tasks_companyId_branchId_idx" ON "follow_up_tasks"("companyId", "branchId");
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "sales_targets" WHERE "branchId" IS NULL) THEN RAISE EXCEPTION 'F5 backfill failed: sales_targets has records without a Primary Branch'; END IF; END $$;
ALTER TABLE "sales_targets" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_company_branch_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "sales_targets_companyId_branchId_idx" ON "sales_targets"("companyId", "branchId");
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "daily_travel_approvals" WHERE "branchId" IS NULL) THEN RAISE EXCEPTION 'F5 backfill failed: daily_travel_approvals has records without a Primary Branch'; END IF; END $$;
ALTER TABLE "daily_travel_approvals" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "daily_travel_approvals" ADD CONSTRAINT "daily_travel_approvals_company_branch_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "daily_travel_approvals_companyId_branchId_idx" ON "daily_travel_approvals"("companyId", "branchId");
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "geofence_events" WHERE "branchId" IS NULL) THEN RAISE EXCEPTION 'F5 backfill failed: geofence_events has records without a Primary Branch'; END IF; END $$;
ALTER TABLE "geofence_events" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_events_company_branch_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "geofence_events_companyId_branchId_idx" ON "geofence_events"("companyId", "branchId");

CREATE TABLE "employee_compensation_profiles" ("id" UUID PRIMARY KEY, "companyId" UUID NOT NULL, "employeeId" UUID NOT NULL, "baseAmount" DECIMAL(18,2) NOT NULL, "currencyCode" CHAR(3) NOT NULL DEFAULT 'INR', "effectiveFrom" DATE NOT NULL, "effectiveUntil" DATE, "status" "CompensationStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "employee_compensation_profiles_employeeId_effectiveFrom_key" ON "employee_compensation_profiles"("employeeId","effectiveFrom");
CREATE INDEX "employee_compensation_profiles_companyId_employeeId_status_idx" ON "employee_compensation_profiles"("companyId","employeeId","status");
ALTER TABLE "employee_compensation_profiles" ADD CONSTRAINT "employee_compensation_employee_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "employee_advances" ("id" UUID PRIMARY KEY, "companyId" UUID NOT NULL, "branchId" UUID NOT NULL, "employeeId" UUID NOT NULL, "amount" DECIMAL(18,2) NOT NULL, "currencyCode" CHAR(3) NOT NULL DEFAULT 'INR', "advanceDate" DATE NOT NULL, "note" VARCHAR(1000), "reference" VARCHAR(120), "status" "EmployeeFinancialRequestStatus" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "employee_advances_companyId_branchId_employeeId_idx" ON "employee_advances"("companyId","branchId","employeeId");
ALTER TABLE "employee_advances" ADD CONSTRAINT "employee_advances_company_branch_fkey" FOREIGN KEY ("companyId","branchId") REFERENCES "branches"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "employee_advances" ADD CONSTRAINT "employee_advances_employee_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "employee_reimbursements" ("id" UUID PRIMARY KEY, "companyId" UUID NOT NULL, "branchId" UUID NOT NULL, "employeeId" UUID NOT NULL, "amount" DECIMAL(18,2) NOT NULL, "currencyCode" CHAR(3) NOT NULL DEFAULT 'INR', "requestedOn" DATE NOT NULL, "description" VARCHAR(2000) NOT NULL, "status" "EmployeeFinancialRequestStatus" NOT NULL DEFAULT 'PENDING', "reviewedByUserId" UUID, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "employee_reimbursements_companyId_branchId_employeeId_status_idx" ON "employee_reimbursements"("companyId","branchId","employeeId","status");
ALTER TABLE "employee_reimbursements" ADD CONSTRAINT "employee_reimbursements_company_branch_fkey" FOREIGN KEY ("companyId","branchId") REFERENCES "branches"("companyId","id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "employee_reimbursements" ADD CONSTRAINT "employee_reimbursements_employee_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "salary_history_links" ("id" UUID PRIMARY KEY, "companyId" UUID NOT NULL, "employeeId" UUID NOT NULL, "compensationProfileId" UUID NOT NULL, "payrollReference" VARCHAR(120), "periodStart" DATE NOT NULL, "periodEnd" DATE NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "salary_history_links_companyId_employeeId_periodStart_periodEnd_key" ON "salary_history_links"("companyId","employeeId","periodStart","periodEnd");
CREATE INDEX "salary_history_links_compensationProfileId_idx" ON "salary_history_links"("compensationProfileId");
ALTER TABLE "salary_history_links" ADD CONSTRAINT "salary_history_compensation_fkey" FOREIGN KEY ("compensationProfileId") REFERENCES "employee_compensation_profiles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- New writes may omit branchId only when the server-visible choice is unambiguous.
-- Ambiguous multi-Branch operations fail closed and must submit an authorized branchId.
CREATE FUNCTION "resolve_operational_branch"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor_id UUID; resolved UUID; choices INTEGER;
BEGIN
  IF NEW."branchId" IS NOT NULL THEN RETURN NEW; END IF;
  actor_id := CASE TG_ARGV[0]
    WHEN 'userId' THEN to_jsonb(NEW)->>'userId'
    WHEN 'assignedUserId' THEN to_jsonb(NEW)->>'assignedUserId'
    WHEN 'employeeId' THEN to_jsonb(NEW)->>'employeeId'
    ELSE NULL END;
  IF actor_id IS NULL THEN
    SELECT count(*), min("id") INTO choices,resolved FROM "branches" WHERE "companyId"=NEW."companyId" AND "isActive"=true;
  ELSE
    SELECT count(*), min(b."id") INTO choices,resolved FROM "branches" b JOIN "users" u ON u."id"=actor_id
      WHERE b."companyId"=NEW."companyId" AND b."isActive"=true AND u."companyId"=NEW."companyId"
      AND (u."branchAccessScope"='ALL_BRANCHES' OR EXISTS (SELECT 1 FROM "user_branch_accesses" a WHERE a."userId"=u."id" AND a."branchId"=b."id"));
  END IF;
  IF choices <> 1 THEN RAISE EXCEPTION 'BRANCH_CONTEXT_REQUIRED'; END IF;
  NEW."branchId" := resolved; RETURN NEW;
END $$;
CREATE TRIGGER "attendances_resolve_branch" BEFORE INSERT ON "attendances" FOR EACH ROW EXECUTE FUNCTION "resolve_operational_branch"('userId');
CREATE TRIGGER "location_points_resolve_branch" BEFORE INSERT ON "location_points" FOR EACH ROW EXECUTE FUNCTION "resolve_operational_branch"('userId');
CREATE TRIGGER "customers_resolve_branch" BEFORE INSERT ON "customers" FOR EACH ROW EXECUTE FUNCTION "resolve_operational_branch"('assignedUserId');
CREATE TRIGGER "customer_visits_resolve_branch" BEFORE INSERT ON "customer_visits" FOR EACH ROW EXECUTE FUNCTION "resolve_operational_branch"('userId');
CREATE TRIGGER "leads_resolve_branch" BEFORE INSERT ON "leads" FOR EACH ROW EXECUTE FUNCTION "resolve_operational_branch"('assignedUserId');
CREATE TRIGGER "follow_up_tasks_resolve_branch" BEFORE INSERT ON "follow_up_tasks" FOR EACH ROW EXECUTE FUNCTION "resolve_operational_branch"('assignedUserId');
CREATE TRIGGER "sales_targets_resolve_branch" BEFORE INSERT ON "sales_targets" FOR EACH ROW EXECUTE FUNCTION "resolve_operational_branch"('assignedUserId');
CREATE TRIGGER "daily_travel_approvals_resolve_branch" BEFORE INSERT ON "daily_travel_approvals" FOR EACH ROW EXECUTE FUNCTION "resolve_operational_branch"('employeeId');
CREATE TRIGGER "geofence_events_resolve_branch" BEFORE INSERT ON "geofence_events" FOR EACH ROW EXECUTE FUNCTION "resolve_operational_branch"('employeeId');
