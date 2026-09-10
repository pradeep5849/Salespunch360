-- CreateEnum
CREATE TYPE "AccountCategoryScope" AS ENUM ('PRODUCT', 'SERVICE', 'BOTH');

-- CreateEnum
CREATE TYPE "CustomFieldEntity" AS ENUM ('CUSTOMER', 'VENDOR', 'PRODUCT', 'SERVICE', 'WORK_PACKAGE');

-- CreateEnum
CREATE TYPE "CustomFieldDataType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'DECIMAL', 'DATE', 'BOOLEAN', 'SELECT');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "gstin" VARCHAR(15),
ADD COLUMN     "isAccountCustomer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "pan" VARCHAR(10),
ADD COLUMN     "shippingAddress" TEXT;

-- CreateTable
CREATE TABLE "account_settings" (
    "companyId" UUID NOT NULL,
    "baseCurrency" CHAR(3) NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_settings_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "financial_years" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numbering_series" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "seriesKey" VARCHAR(60) NOT NULL,
    "prefix" VARCHAR(30) NOT NULL DEFAULT '',
    "nextSequence" BIGINT NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 5,
    "suffix" VARCHAR(30) NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "numbering_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gstin" VARCHAR(15),
    "pan" VARCHAR(10),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_units" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_categories" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "scope" "AccountCategoryScope" NOT NULL DEFAULT 'BOTH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_products" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "categoryId" UUID,
    "unitId" UUID,
    "name" TEXT NOT NULL,
    "code" VARCHAR(60),
    "description" TEXT,
    "salePrice" DECIMAL(18,2),
    "costPrice" DECIMAL(18,2),
    "taxRate" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_services" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "categoryId" UUID,
    "unitId" UUID,
    "name" TEXT NOT NULL,
    "code" VARCHAR(60),
    "description" TEXT,
    "sellingRate" DECIMAL(18,2),
    "estimatedCost" DECIMAL(18,2),
    "taxRate" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_categories" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_packages" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "workCategoryId" UUID NOT NULL,
    "unitId" UUID,
    "name" TEXT NOT NULL,
    "code" VARCHAR(60),
    "description" TEXT,
    "sellingRate" DECIMAL(18,2),
    "estimatedCost" DECIMAL(18,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "entityType" "CustomFieldEntity" NOT NULL,
    "fieldKey" VARCHAR(60) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "dataType" "CustomFieldDataType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "validation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_years_companyId_startDate_endDate_idx" ON "financial_years"("companyId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "financial_years_companyId_name_key" ON "financial_years"("companyId", "name");

-- CreateIndex
CREATE INDEX "numbering_series_companyId_seriesKey_idx" ON "numbering_series"("companyId", "seriesKey");

-- CreateIndex
CREATE UNIQUE INDEX "numbering_series_companyId_branchId_seriesKey_key" ON "numbering_series"("companyId", "branchId", "seriesKey");

-- CreateIndex
CREATE INDEX "vendors_companyId_name_idx" ON "vendors"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "account_units_companyId_name_key" ON "account_units"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "account_units_companyId_symbol_key" ON "account_units"("companyId", "symbol");

-- CreateIndex
CREATE INDEX "account_categories_companyId_scope_isActive_idx" ON "account_categories"("companyId", "scope", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "account_categories_companyId_name_key" ON "account_categories"("companyId", "name");

-- CreateIndex
CREATE INDEX "account_products_companyId_name_idx" ON "account_products"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "account_products_companyId_code_key" ON "account_products"("companyId", "code");

-- CreateIndex
CREATE INDEX "account_services_companyId_name_idx" ON "account_services"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "account_services_companyId_code_key" ON "account_services"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "work_categories_companyId_name_key" ON "work_categories"("companyId", "name");

-- CreateIndex
CREATE INDEX "work_packages_companyId_name_idx" ON "work_packages"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "work_packages_companyId_code_key" ON "work_packages"("companyId", "code");

-- CreateIndex
CREATE INDEX "custom_field_definitions_companyId_entityType_isActive_posi_idx" ON "custom_field_definitions"("companyId", "entityType", "isActive", "position");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_companyId_entityType_fieldKey_key" ON "custom_field_definitions"("companyId", "entityType", "fieldKey");

-- AddForeignKey
ALTER TABLE "account_settings" ADD CONSTRAINT "account_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "financial_years" ADD CONSTRAINT "financial_years_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "numbering_series" ADD CONSTRAINT "numbering_series_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "numbering_series" ADD CONSTRAINT "numbering_series_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "account_units" ADD CONSTRAINT "account_units_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "account_categories" ADD CONSTRAINT "account_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "account_products" ADD CONSTRAINT "account_products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "account_products" ADD CONSTRAINT "account_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "account_categories"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "account_products" ADD CONSTRAINT "account_products_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "account_units"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "account_services" ADD CONSTRAINT "account_services_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "account_services" ADD CONSTRAINT "account_services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "account_categories"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "account_services" ADD CONSTRAINT "account_services_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "account_units"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "work_categories" ADD CONSTRAINT "work_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_workCategoryId_fkey" FOREIGN KEY ("workCategoryId") REFERENCES "work_categories"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "account_units"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "numbering_series_company_default_key" ON "numbering_series"("companyId", "seriesKey") WHERE "branchId" IS NULL;
CREATE UNIQUE INDEX "financial_years_one_current" ON "financial_years"("companyId") WHERE "isCurrent" = true;
ALTER TABLE "financial_years" ADD CONSTRAINT "financial_year_dates_valid" CHECK ("endDate" > "startDate");
ALTER TABLE "numbering_series" ADD CONSTRAINT "numbering_series_values_valid" CHECK ("nextSequence" > 0 AND "padding" BETWEEN 1 AND 18);
ALTER TABLE "account_products" ADD CONSTRAINT "account_products_rates_valid" CHECK (("salePrice" IS NULL OR "salePrice" >= 0) AND ("costPrice" IS NULL OR "costPrice" >= 0) AND ("taxRate" IS NULL OR "taxRate" BETWEEN 0 AND 100));
ALTER TABLE "account_services" ADD CONSTRAINT "account_services_rates_valid" CHECK (("sellingRate" IS NULL OR "sellingRate" >= 0) AND ("estimatedCost" IS NULL OR "estimatedCost" >= 0) AND ("taxRate" IS NULL OR "taxRate" BETWEEN 0 AND 100));
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_rates_valid" CHECK (("sellingRate" IS NULL OR "sellingRate" >= 0) AND ("estimatedCost" IS NULL OR "estimatedCost" >= 0));

-- Establish an authoritative INR base currency for existing Account-capable tenants.
INSERT INTO "account_settings" ("companyId", "baseCurrency", "createdAt", "updatedAt")
SELECT id, 'INR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "companies"
WHERE "productEdition" IN ('SALESPUNCH360_ACCOUNT', 'SALESPUNCH360_PLUS')
ON CONFLICT ("companyId") DO NOTHING;
