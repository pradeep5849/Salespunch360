-- F4-1 is additive. Existing companies retain the Sales edition supplied by the
-- existing column default and receive no Account package.
ALTER TABLE "companies"
ADD COLUMN "accountPackageQuantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "companies"
ADD CONSTRAINT "companies_account_package_quantity_nonnegative"
CHECK ("accountPackageQuantity" >= 0);
