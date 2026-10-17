-- Optional private item photos; existing catalogue and financial data remain unchanged.
ALTER TABLE "account_products" ADD COLUMN "photoObjectKey" VARCHAR(512);
ALTER TABLE "account_services" ADD COLUMN "photoObjectKey" VARCHAR(512);
