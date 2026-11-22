-- Stable per-intent keys protect uncertain creation retries without imposing phone/name uniqueness.
ALTER TABLE "customers" ADD COLUMN "creationRequestKey" UUID, ADD COLUMN "creationRequestHash" CHAR(64);
CREATE UNIQUE INDEX "customers_companyId_creationRequestKey_key" ON "customers"("companyId","creationRequestKey");
ALTER TABLE "follow_up_tasks" ADD COLUMN "creationRequestKey" UUID, ADD COLUMN "creationRequestHash" CHAR(64);
CREATE UNIQUE INDEX "follow_up_tasks_companyId_creationRequestKey_key" ON "follow_up_tasks"("companyId","creationRequestKey");
