-- Loan receipt retries must resolve to one operational and accounting event.
ALTER TABLE "loans" ADD COLUMN "idempotencyKey" VARCHAR(160);
CREATE UNIQUE INDEX "loans_companyId_idempotencyKey_key" ON "loans"("companyId", "idempotencyKey");
-- New writes require a key; existing rows remain readable without an unsafe backfill.
