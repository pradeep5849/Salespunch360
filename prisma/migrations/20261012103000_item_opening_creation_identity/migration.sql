BEGIN;
ALTER TABLE "account_products" ADD COLUMN "creationRequestKey" UUID, ADD COLUMN "creationRequestHash" VARCHAR(64), ADD COLUMN "itemLocation" VARCHAR(240);
CREATE UNIQUE INDEX "account_products_companyId_creationRequestKey_key" ON "account_products"("companyId","creationRequestKey");
COMMIT;
