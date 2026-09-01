ALTER TABLE "customer_visits" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "customer_visits" DROP COLUMN IF EXISTS "photoDataUrl";
ALTER TABLE "customers" ADD COLUMN "checkInReferenceLatitude" DOUBLE PRECISION,
 ADD COLUMN "checkInReferenceLongitude" DOUBLE PRECISION,
 ADD COLUMN "checkInReferenceVisitId" UUID,
 ADD COLUMN "checkInReferenceSetAt" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN "checkInReferenceLatitude" DOUBLE PRECISION,
 ADD COLUMN "checkInReferenceLongitude" DOUBLE PRECISION,
 ADD COLUMN "checkInReferenceVisitId" UUID,
 ADD COLUMN "checkInReferenceSetAt" TIMESTAMP(3);
WITH first_visits AS (SELECT DISTINCT ON ("customerId") "customerId","id","checkInLatitude","checkInLongitude","checkedInAt" FROM "customer_visits" WHERE "customerId" IS NOT NULL ORDER BY "customerId","checkedInAt","id")
UPDATE "customers" c SET "checkInReferenceLatitude"=v."checkInLatitude", "checkInReferenceLongitude"=v."checkInLongitude", "checkInReferenceVisitId"=v."id", "checkInReferenceSetAt"=v."checkedInAt" FROM first_visits v WHERE c."id"=v."customerId";
UPDATE "leads" l SET "checkInReferenceLatitude"=v."checkInLatitude", "checkInReferenceLongitude"=v."checkInLongitude", "checkInReferenceVisitId"=v."id", "checkInReferenceSetAt"=v."checkedInAt"
FROM "customer_visits" v WHERE l."sourceVisitId"=v."id";
CREATE TABLE "visit_photos" (
 "id" UUID NOT NULL, "companyId" UUID NOT NULL, "visitId" UUID NOT NULL,
 "uploadedByUserId" UUID NOT NULL, "objectKey" VARCHAR(500) NOT NULL,
 "thumbnailObjectKey" VARCHAR(500) NOT NULL, "mimeType" VARCHAR(100) NOT NULL,
 "sizeBytes" INTEGER NOT NULL, "thumbnailSizeBytes" INTEGER NOT NULL,
 "width" INTEGER NOT NULL, "height" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "visit_photos_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "visit_photos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT "visit_photos_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "customer_visits"("id") ON DELETE CASCADE ON UPDATE RESTRICT,
 CONSTRAINT "visit_photos_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "visit_photos_visitId_key" ON "visit_photos"("visitId");
CREATE INDEX "visit_photos_companyId_createdAt_idx" ON "visit_photos"("companyId", "createdAt");
CREATE UNIQUE INDEX "customer_visits_one_open_per_user" ON "customer_visits"("companyId", "userId") WHERE "checkedOutAt" IS NULL;
