-- Legacy change orders retain NULL request identity; no historical rows are rewritten.
ALTER TABLE "project_change_orders"
  ADD COLUMN "requestKey" VARCHAR(120),
  ADD COLUMN "requestHash" VARCHAR(64);
CREATE UNIQUE INDEX "project_change_orders_companyId_requestKey_key"
  ON "project_change_orders"("companyId", "requestKey");
