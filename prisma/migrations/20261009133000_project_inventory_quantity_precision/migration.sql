-- Project movements accept six fractional quantity digits. Preserve exact
-- company quantity in the corresponding inventory bridge movements as well.
-- Existing four-decimal quantities are retained exactly; no history is rewritten.
ALTER TABLE "stock_movements" ALTER COLUMN "quantity" TYPE DECIMAL(20,6);
