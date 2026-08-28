CREATE TYPE "GeofenceEventType" AS ENUM ('OUTSIDE_RADIUS','INSUFFICIENT_ACCURACY');
CREATE TYPE "GeofenceAction" AS ENUM ('ATTENDANCE_START','CUSTOMER_CHECK_IN');
CREATE TYPE "TargetMetric" AS ENUM ('WON_LEADS_COUNT','WON_LEADS_VALUE');
CREATE TYPE "TargetPeriodType" AS ENUM ('MONTHLY','QUARTERLY','CUSTOM');
ALTER TABLE "companies"
 ADD COLUMN "attendanceGeofenceEnabled" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "attendanceReferenceLatitude" DOUBLE PRECISION,
 ADD COLUMN "attendanceReferenceLongitude" DOUBLE PRECISION,
 ADD COLUMN "attendanceGeofenceRadiusMeters" INTEGER,
 ADD COLUMN "customerCheckInGeofenceEnabled" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "customerCheckInGeofenceRadiusMeters" INTEGER,
 ADD CONSTRAINT "companies_attendance_geofence_check" CHECK (
   ("attendanceReferenceLatitude" IS NULL AND "attendanceReferenceLongitude" IS NULL OR
    "attendanceReferenceLatitude" BETWEEN -90 AND 90 AND "attendanceReferenceLongitude" BETWEEN -180 AND 180) AND
   ("attendanceGeofenceRadiusMeters" IS NULL OR "attendanceGeofenceRadiusMeters" BETWEEN 10 AND 100000) AND
   (NOT "attendanceGeofenceEnabled" OR ("attendanceReferenceLatitude" IS NOT NULL AND "attendanceReferenceLongitude" IS NOT NULL AND "attendanceGeofenceRadiusMeters" IS NOT NULL))
 ),
 ADD CONSTRAINT "companies_customer_geofence_check" CHECK (
   ("customerCheckInGeofenceRadiusMeters" IS NULL OR "customerCheckInGeofenceRadiusMeters" BETWEEN 10 AND 100000) AND
   (NOT "customerCheckInGeofenceEnabled" OR "customerCheckInGeofenceRadiusMeters" IS NOT NULL)
 );
CREATE UNIQUE INDEX "attendances_id_company_user_key" ON "attendances"("id","companyId","userId");
CREATE TABLE "geofence_events" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "companyId" UUID NOT NULL, "employeeId" UUID NOT NULL,
 "type" "GeofenceEventType" NOT NULL, "action" "GeofenceAction" NOT NULL, "customerId" UUID, "attendanceId" UUID,
 "referenceLatitude" DOUBLE PRECISION NOT NULL, "referenceLongitude" DOUBLE PRECISION NOT NULL,
 "actualLatitude" DOUBLE PRECISION NOT NULL, "actualLongitude" DOUBLE PRECISION NOT NULL, "accuracyMeters" DOUBLE PRECISION,
 "allowedRadiusMeters" INTEGER NOT NULL, "distanceMeters" DOUBLE PRECISION, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "geofence_coordinates_check" CHECK ("referenceLatitude" BETWEEN -90 AND 90 AND "actualLatitude" BETWEEN -90 AND 90 AND "referenceLongitude" BETWEEN -180 AND 180 AND "actualLongitude" BETWEEN -180 AND 180),
 CONSTRAINT "geofence_measurements_check" CHECK ("allowedRadiusMeters" BETWEEN 10 AND 100000 AND ("accuracyMeters" IS NULL OR "accuracyMeters" BETWEEN 0 AND 10000) AND ("distanceMeters" IS NULL OR "distanceMeters" >= 0)),
 CONSTRAINT "geofence_type_distance_check" CHECK (("type"='OUTSIDE_RADIUS' AND "distanceMeters" IS NOT NULL AND "distanceMeters">"allowedRadiusMeters") OR ("type"='INSUFFICIENT_ACCURACY')),
 CONSTRAINT "geofence_context_check" CHECK (("action"='ATTENDANCE_START' AND "customerId" IS NULL AND "attendanceId" IS NULL) OR ("action"='CUSTOMER_CHECK_IN' AND "customerId" IS NOT NULL AND "attendanceId" IS NULL))
);
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_company_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_employee_tenant_fkey" FOREIGN KEY ("employeeId","companyId") REFERENCES "users"("id","companyId") ON DELETE RESTRICT;
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_customer_tenant_fkey" FOREIGN KEY ("customerId","companyId") REFERENCES "customers"("id","companyId") ON DELETE RESTRICT;
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_attendance_owner_fkey" FOREIGN KEY ("attendanceId","companyId","employeeId") REFERENCES "attendances"("id","companyId","userId") ON DELETE RESTRICT;
CREATE INDEX "geofence_company_occurred_idx" ON "geofence_events"("companyId","occurredAt");
CREATE INDEX "geofence_company_employee_occurred_idx" ON "geofence_events"("companyId","employeeId","occurredAt");
CREATE INDEX "geofence_company_action_occurred_idx" ON "geofence_events"("companyId","action","occurredAt");
CREATE INDEX "geofence_customer_occurred_idx" ON "geofence_events"("customerId","occurredAt");
CREATE FUNCTION prevent_geofence_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'geofence event is append-only'; END $$;
CREATE TRIGGER "geofence_events_append_only" BEFORE UPDATE OR DELETE ON "geofence_events" FOR EACH ROW EXECUTE FUNCTION prevent_geofence_event_mutation();
CREATE TABLE "sales_targets" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "companyId" UUID NOT NULL, "assignedUserId" UUID NOT NULL, "createdByUserId" UUID NOT NULL,
 "metric" "TargetMetric" NOT NULL, "periodType" "TargetPeriodType" NOT NULL, "startDate" DATE NOT NULL, "endDate" DATE NOT NULL,
 "targetValue" NUMERIC(18,2) NOT NULL, "currencyCode" CHAR(3) NOT NULL DEFAULT 'INR', "version" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "targets_period_check" CHECK ("startDate" <= "endDate" AND "endDate"-"startDate" <= 366),
 CONSTRAINT "targets_value_check" CHECK ("targetValue">0 AND "targetValue"<=9999999999999999.99 AND ("metric"<>'WON_LEADS_COUNT' OR trunc("targetValue")="targetValue")),
 CONSTRAINT "targets_currency_check" CHECK ("currencyCode" ~ '^[A-Z]{3}$'), CONSTRAINT "targets_version_check" CHECK ("version">0),
 CONSTRAINT "targets_exact_unique" UNIQUE ("companyId","assignedUserId","metric","startDate","endDate")
);
ALTER TABLE "sales_targets" ADD CONSTRAINT "targets_company_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "sales_targets" ADD CONSTRAINT "targets_assignee_tenant_fkey" FOREIGN KEY ("assignedUserId","companyId") REFERENCES "users"("id","companyId") ON DELETE RESTRICT;
ALTER TABLE "sales_targets" ADD CONSTRAINT "targets_creator_tenant_fkey" FOREIGN KEY ("createdByUserId","companyId") REFERENCES "users"("id","companyId") ON DELETE RESTRICT;
CREATE INDEX "targets_company_assignee_idx" ON "sales_targets"("companyId","assignedUserId");
CREATE INDEX "targets_company_period_idx" ON "sales_targets"("companyId","startDate","endDate");
CREATE INDEX "targets_company_metric_idx" ON "sales_targets"("companyId","metric");
