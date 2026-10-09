-- Nullable additions preserve all existing asset rows and their numbers.
ALTER TABLE "assets" ADD COLUMN "creationRequestKey" UUID, ADD COLUMN "creationRequestHash" VARCHAR(64);
CREATE UNIQUE INDEX "assets_companyId_creationRequestKey_key" ON "assets"("companyId", "creationRequestKey");
