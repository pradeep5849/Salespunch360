CREATE TABLE "expense_items" (
 "id" UUID NOT NULL,
 "companyId" UUID NOT NULL,
 "name" VARCHAR(240) NOT NULL,
 "normalizedName" VARCHAR(240) NOT NULL,
 "creationRequestKey" UUID NOT NULL,
 "creationRequestHash" VARCHAR(64) NOT NULL,
 "photoObjectKey" VARCHAR(500),
 "photoMimeType" VARCHAR(80),
 "isActive" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "expense_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "expense_items_companyId_id_key" ON "expense_items"("companyId","id");
CREATE UNIQUE INDEX "expense_items_companyId_normalizedName_key" ON "expense_items"("companyId","normalizedName");
CREATE UNIQUE INDEX "expense_items_companyId_creationRequestKey_key" ON "expense_items"("companyId","creationRequestKey");
CREATE INDEX "expense_items_companyId_isActive_name_idx" ON "expense_items"("companyId","isActive","name");
