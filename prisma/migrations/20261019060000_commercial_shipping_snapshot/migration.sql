-- Retain document-specific delivery addresses without reconstructing historical values.
ALTER TABLE "commercial_documents" ADD COLUMN "shippingAddress" TEXT;
