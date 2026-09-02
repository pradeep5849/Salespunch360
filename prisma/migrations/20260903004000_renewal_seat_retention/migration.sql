ALTER TABLE "billing_orders"
  ADD COLUMN "retainManagerUserIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "retainSalesUserIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "seatReductionAppliedAt" TIMESTAMP(3);
