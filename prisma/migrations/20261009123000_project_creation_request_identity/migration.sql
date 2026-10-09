-- Preserve legacy Projects and their financial history with nullable request identity.
ALTER TABLE "projects"
  ADD COLUMN "creationRequestKey" VARCHAR(120),
  ADD COLUMN "creationRequestHash" VARCHAR(64);
CREATE UNIQUE INDEX "projects_companyId_creationRequestKey_key"
  ON "projects"("companyId", "creationRequestKey");
