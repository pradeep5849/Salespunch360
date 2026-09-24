ALTER TABLE "billing_orders"
  ADD COLUMN IF NOT EXISTS "telecallerSeats" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "telecallerSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "telecallerIncluded" BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing dedicated Telecaller orders remain historical. New Sales-team orders
-- use these fields so Admin/Manager/Sales/Telecaller can be purchased together.
