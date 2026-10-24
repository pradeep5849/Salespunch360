-- Nullable: existing item rates and historical documents remain unchanged.
ALTER TABLE "account_products" ADD COLUMN "pricing" JSONB;
ALTER TABLE "account_services" ADD COLUMN "pricing" JSONB;
