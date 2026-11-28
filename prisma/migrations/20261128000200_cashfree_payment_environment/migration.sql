ALTER TABLE "billing_orders" ADD COLUMN "paymentEnvironment" VARCHAR(16);
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_order_payment_environment_check" CHECK ("paymentEnvironment" IS NULL OR "paymentEnvironment" IN ('sandbox', 'production'));
-- NULL is deliberately retained for legacy sandbox-only orders; no billing data is rewritten.
