ALTER TABLE account_settlements ADD COLUMN "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE settlement_allocations ADD COLUMN "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE account_settlements ADD CONSTRAINT settlement_discount_valid CHECK ("discountAmount" >= 0 AND ("discountAmount" = 0 OR "type" = 'CUSTOMER_RECEIPT'));
ALTER TABLE settlement_allocations ADD CONSTRAINT allocation_discount_valid CHECK ("discountAmount" >= 0 AND "discountAmount" < "amount");
