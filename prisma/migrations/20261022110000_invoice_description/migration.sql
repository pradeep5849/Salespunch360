-- Separate invoice description from existing terms; historical records remain unchanged.
ALTER TABLE "commercial_documents" ADD COLUMN "invoiceDescription" VARCHAR(5000);
