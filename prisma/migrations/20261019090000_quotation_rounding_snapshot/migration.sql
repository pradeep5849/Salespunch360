-- Preserve all historical quotation totals. Existing revisions retain no rounding.
-- The existing revision immutability trigger compares the complete JSON row,
-- so these added fields are protected for pending/issued snapshots too.
ALTER TABLE "quotation_revisions"
  ADD COLUMN "roundOffEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "roundOffAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
