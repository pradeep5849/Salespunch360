-- Preserve posted payment history; optional description has no invented backfill.
ALTER TABLE "loan_payments" ADD COLUMN "description" VARCHAR(2000);
