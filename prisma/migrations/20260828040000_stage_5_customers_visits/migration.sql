CREATE TYPE "CheckoutSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

ALTER TABLE "companies" ADD COLUMN "checkoutRequiredBeforeNextCheckIn" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "customers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL, "contactPerson" TEXT, "phone" TEXT, "email" TEXT, "address" TEXT,
  "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customers_coordinates_check" CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180))
);

CREATE TABLE "customer_visits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "companyId" UUID NOT NULL, "userId" UUID NOT NULL,
  "customerId" UUID NOT NULL, "attendanceId" UUID,
  "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkInLatitude" DOUBLE PRECISION NOT NULL, "checkInLongitude" DOUBLE PRECISION NOT NULL, "checkInAccuracyMeters" DOUBLE PRECISION NOT NULL,
  "checkedOutAt" TIMESTAMP(3), "checkOutLatitude" DOUBLE PRECISION, "checkOutLongitude" DOUBLE PRECISION, "checkOutAccuracyMeters" DOUBLE PRECISION,
  "checkoutSentiment" "CheckoutSentiment", "checkoutRemarks" TEXT, "visitNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_visits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_visits_checkin_coordinates_check" CHECK ("checkInLatitude" BETWEEN -90 AND 90 AND "checkInLongitude" BETWEEN -180 AND 180 AND "checkInAccuracyMeters" BETWEEN 0 AND 10000),
  CONSTRAINT "customer_visits_checkout_consistency_check" CHECK (
    ("checkedOutAt" IS NULL AND "checkOutLatitude" IS NULL AND "checkOutLongitude" IS NULL AND "checkOutAccuracyMeters" IS NULL AND "checkoutSentiment" IS NULL AND "checkoutRemarks" IS NULL)
    OR ("checkedOutAt" IS NOT NULL AND "checkedOutAt" >= "checkedInAt" AND "checkOutLatitude" BETWEEN -90 AND 90 AND "checkOutLongitude" BETWEEN -180 AND 180 AND "checkOutAccuracyMeters" BETWEEN 0 AND 10000 AND "checkoutSentiment" IS NOT NULL)
  ),
  CONSTRAINT "customer_visits_notes_length_check" CHECK (length(COALESCE("visitNotes", '')) <= 2000 AND length(COALESCE("checkoutRemarks", '')) <= 2000)
);

CREATE INDEX "customers_companyId_name_idx" ON "customers"("companyId", "name");
CREATE INDEX "customers_companyId_createdAt_idx" ON "customers"("companyId", "createdAt");
CREATE INDEX "customer_visits_companyId_checkedInAt_idx" ON "customer_visits"("companyId", "checkedInAt");
CREATE INDEX "customer_visits_companyId_userId_checkedInAt_idx" ON "customer_visits"("companyId", "userId", "checkedInAt");
CREATE INDEX "customer_visits_companyId_customerId_checkedInAt_idx" ON "customer_visits"("companyId", "customerId", "checkedInAt");
CREATE INDEX "customer_visits_companyId_userId_checkedOutAt_idx" ON "customer_visits"("companyId", "userId", "checkedOutAt");

ALTER TABLE "customers" ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "customer_visits" ADD CONSTRAINT "customer_visits_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "customer_visits" ADD CONSTRAINT "customer_visits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "customer_visits" ADD CONSTRAINT "customer_visits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "customer_visits" ADD CONSTRAINT "customer_visits_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION validate_customer_visit_tenant() RETURNS trigger AS $$
DECLARE user_company UUID; customer_company UUID; attendance_company UUID; attendance_user UUID;
BEGIN
  SELECT "companyId" INTO user_company FROM "users" WHERE "id" = NEW."userId";
  SELECT "companyId" INTO customer_company FROM "customers" WHERE "id" = NEW."customerId";
  IF user_company IS DISTINCT FROM NEW."companyId" OR customer_company IS DISTINCT FROM NEW."companyId" THEN RAISE EXCEPTION 'visit tenant mismatch'; END IF;
  IF NEW."attendanceId" IS NOT NULL THEN
    SELECT "companyId", "userId" INTO attendance_company, attendance_user FROM "attendances" WHERE "id" = NEW."attendanceId";
    IF attendance_company IS DISTINCT FROM NEW."companyId" OR attendance_user IS DISTINCT FROM NEW."userId" THEN RAISE EXCEPTION 'visit attendance ownership mismatch'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER customer_visit_tenant_check BEFORE INSERT OR UPDATE OF "companyId", "userId", "customerId", "attendanceId" ON "customer_visits" FOR EACH ROW EXECUTE FUNCTION validate_customer_visit_tenant();
