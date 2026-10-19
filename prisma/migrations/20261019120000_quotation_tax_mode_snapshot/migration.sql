-- Historical quotation calculations were exclusive-tax; retain their basis and totals.
-- Existing full-row revision immutability also protects this added field.
ALTER TABLE "quotation_revisions" ADD COLUMN "taxMode" "TaxMode" NOT NULL DEFAULT 'EXCLUSIVE';
