CREATE TABLE "billing_carts" (
 "companyId" UUID PRIMARY KEY REFERENCES "companies"("id") ON DELETE CASCADE,
 "selection" JSONB NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0),
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "billing_carts" ADD COLUMN "checkoutOrderId" UUID;
