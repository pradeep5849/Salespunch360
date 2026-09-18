ALTER TABLE "billing_orders" ADD COLUMN IF NOT EXISTS "accountPackages" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "company_subscriptions" ADD COLUMN IF NOT EXISTS "accountPackages" INTEGER NOT NULL DEFAULT 0;

-- Preserve historical Account-package entitlements created before the dedicated column existed.
UPDATE "billing_orders" SET "accountPackages" = "adminSeats" WHERE "provider" = 'ACCOUNT_PACKAGE' AND "accountPackages" = 0;
UPDATE "company_subscriptions" s SET "accountPackages" = s."adminSeats"
FROM "billing_orders" o
WHERE s."sourceOrderId" = o."id" AND o."provider" = 'ACCOUNT_PACKAGE' AND s."accountPackages" = 0;
