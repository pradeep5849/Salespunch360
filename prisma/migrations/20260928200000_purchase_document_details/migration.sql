ALTER TABLE "commercial_documents"
 ADD COLUMN "vendorInvoiceNumber" VARCHAR(120),
 ADD COLUMN "vendorInvoiceNumberNormalized" VARCHAR(120),
 ADD COLUMN "vendorInvoiceDate" DATE,
 ADD COLUMN "postingDate" DATE,
 ADD COLUMN "paymentTerms" VARCHAR(500),
 ADD COLUMN "partyAddress" TEXT,
 ADD COLUMN "grnReference" VARCHAR(160),
 ADD COLUMN "purchaseLocation" VARCHAR(240),
 ADD COLUMN "vendorInvoiceAttachmentKey" VARCHAR(512),
 ADD COLUMN "purchaseFinancialYearId" UUID,
 ADD COLUMN "freightAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
 ADD COLUMN "otherChargesAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
 ADD COLUMN "roundOffAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "commercial_documents_vendor_invoice_period_key" ON "commercial_documents"("companyId","vendorId","purchaseFinancialYearId","vendorInvoiceNumberNormalized") WHERE "vendorInvoiceNumberNormalized" IS NOT NULL AND "status" <> 'CANCELLED';
CREATE INDEX "commercial_documents_vendor_invoice_idx" ON "commercial_documents"("companyId","vendorId","vendorInvoiceNumberNormalized");
