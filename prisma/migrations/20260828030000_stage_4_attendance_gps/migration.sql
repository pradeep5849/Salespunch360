ALTER TABLE "companies"
  ADD COLUMN "attendanceEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "gpsTrackingEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "attendances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "startLatitude" DOUBLE PRECISION,
  "startLongitude" DOUBLE PRECISION,
  "startAccuracyMeters" DOUBLE PRECISION,
  "endLatitude" DOUBLE PRECISION,
  "endLongitude" DOUBLE PRECISION,
  "endAccuracyMeters" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendances_time_check" CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt"),
  CONSTRAINT "attendances_start_latitude_check" CHECK ("startLatitude" IS NULL OR "startLatitude" BETWEEN -90 AND 90),
  CONSTRAINT "attendances_start_longitude_check" CHECK ("startLongitude" IS NULL OR "startLongitude" BETWEEN -180 AND 180),
  CONSTRAINT "attendances_end_latitude_check" CHECK ("endLatitude" IS NULL OR "endLatitude" BETWEEN -90 AND 90),
  CONSTRAINT "attendances_end_longitude_check" CHECK ("endLongitude" IS NULL OR "endLongitude" BETWEEN -180 AND 180),
  CONSTRAINT "attendances_accuracy_check" CHECK (("startAccuracyMeters" IS NULL OR "startAccuracyMeters" BETWEEN 0 AND 10000) AND ("endAccuracyMeters" IS NULL OR "endAccuracyMeters" BETWEEN 0 AND 10000))
);

CREATE TABLE "location_points" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "attendanceId" UUID NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracyMeters" DOUBLE PRECISION,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sequenceNumber" INTEGER NOT NULL,
  CONSTRAINT "location_points_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "location_points_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
  CONSTRAINT "location_points_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180),
  CONSTRAINT "location_points_accuracy_check" CHECK ("accuracyMeters" IS NULL OR "accuracyMeters" BETWEEN 0 AND 10000),
  CONSTRAINT "location_points_sequence_check" CHECK ("sequenceNumber" > 0)
);

CREATE UNIQUE INDEX "attendances_one_open_per_user_key" ON "attendances"("userId") WHERE "endedAt" IS NULL;
CREATE INDEX "attendances_companyId_startedAt_idx" ON "attendances"("companyId", "startedAt");
CREATE INDEX "attendances_companyId_userId_startedAt_idx" ON "attendances"("companyId", "userId", "startedAt");
CREATE UNIQUE INDEX "location_points_attendanceId_sequenceNumber_key" ON "location_points"("attendanceId", "sequenceNumber");
CREATE INDEX "location_points_companyId_userId_capturedAt_idx" ON "location_points"("companyId", "userId", "capturedAt");
CREATE INDEX "location_points_attendanceId_capturedAt_idx" ON "location_points"("attendanceId", "capturedAt");

ALTER TABLE "attendances" ADD CONSTRAINT "attendances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "location_points" ADD CONSTRAINT "location_points_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "location_points" ADD CONSTRAINT "location_points_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "location_points" ADD CONSTRAINT "location_points_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE FUNCTION validate_attendance_tenant() RETURNS trigger AS $$
DECLARE user_company UUID;
BEGIN
  SELECT "companyId" INTO user_company FROM "users" WHERE "id" = NEW."userId";
  IF user_company IS DISTINCT FROM NEW."companyId" THEN RAISE EXCEPTION 'attendance user must belong to company'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER attendance_tenant_check BEFORE INSERT OR UPDATE OF "companyId", "userId" ON "attendances" FOR EACH ROW EXECUTE FUNCTION validate_attendance_tenant();

CREATE FUNCTION validate_location_tenant() RETURNS trigger AS $$
DECLARE attendance_company UUID; attendance_user UUID;
BEGIN
  SELECT "companyId", "userId" INTO attendance_company, attendance_user FROM "attendances" WHERE "id" = NEW."attendanceId";
  IF attendance_company IS DISTINCT FROM NEW."companyId" OR attendance_user IS DISTINCT FROM NEW."userId" THEN RAISE EXCEPTION 'location point ownership mismatch'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER location_tenant_check BEFORE INSERT OR UPDATE OF "companyId", "userId", "attendanceId" ON "location_points" FOR EACH ROW EXECUTE FUNCTION validate_location_tenant();
