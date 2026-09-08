-- F3KL is additive: historical subscription/order snapshots and price rows are preserved.
ALTER TABLE "company_subscriptions" ADD COLUMN "adminSeats" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "billing_orders"
  ADD COLUMN "adminSeats" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "adminUnitPrice" NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "retainAdminUserIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

ALTER TABLE "company_subscriptions" DROP CONSTRAINT "subscription_check";
ALTER TABLE "company_subscriptions" ADD CONSTRAINT "subscription_check" CHECK (
  "adminSeats" BETWEEN 0 AND 10000 AND "managerSeats" BETWEEN 0 AND 10000 AND
  "salesSeats" BETWEEN 0 AND 10000 AND "startsAt" < "endsAt"
);
ALTER TABLE "billing_orders" DROP CONSTRAINT "order_seats_check";
ALTER TABLE "billing_orders" DROP CONSTRAINT "order_money_check";
ALTER TABLE "billing_orders" ADD CONSTRAINT "order_seats_check" CHECK (
  "adminSeats" BETWEEN 0 AND 10000 AND "managerSeats" BETWEEN 0 AND 10000 AND
  "salesSeats" BETWEEN 0 AND 10000 AND "adminSeats" + "managerSeats" + "salesSeats" > 0
);
-- Zero is permitted only as the safe snapshot for orders created before Admin billing.
ALTER TABLE "billing_orders" ADD CONSTRAINT "order_money_check" CHECK (
  "adminUnitPrice" >= 0 AND "managerUnitPrice" > 0 AND "salesUnitPrice" > 0 AND
  "subtotal" = "adminUnitPrice" * "adminSeats" + "managerUnitPrice" * "managerSeats" + "salesUnitPrice" * "salesSeats" AND
  "taxAmount" >= 0 AND "totalAmount" = "subtotal" + "taxAmount" AND "currency" ~ '^[A-Z]{3}$'
);

CREATE OR REPLACE FUNCTION prevent_paid_order_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='PAID' AND
   (NEW."adminSeats",NEW."managerSeats",NEW."salesSeats",NEW."adminUnitPrice",NEW."managerUnitPrice",NEW."salesUnitPrice",NEW.currency,NEW.subtotal,NEW."taxAmount",NEW."totalAmount")
   IS DISTINCT FROM
   (OLD."adminSeats",OLD."managerSeats",OLD."salesSeats",OLD."adminUnitPrice",OLD."managerUnitPrice",OLD."salesUnitPrice",OLD.currency,OLD.subtotal,OLD."taxAmount",OLD."totalAmount")
 THEN RAISE EXCEPTION 'paid order snapshot is immutable'; END IF;
 RETURN NEW;
END$$;

-- Close only current prices which differ, then insert the locked current snapshots.
WITH desired(role,period,amount) AS (VALUES
 ('ADMIN'::"BillingRole",'MONTHLY'::"BillingPeriod",250::numeric),
 ('ADMIN','SIX_MONTH',1400),('ADMIN','YEARLY',2800),
 ('MANAGER','MONTHLY',200),('MANAGER','SIX_MONTH',1100),('MANAGER','YEARLY',2100),
 ('SALES','MONTHLY',150),('SALES','SIX_MONTH',800),('SALES','YEARLY',1500)
), cutoff AS (SELECT TIMESTAMP '2026-09-08 00:00:00' AS at)
UPDATE "billing_prices" p SET "effectiveUntil"=cutoff.at
FROM desired d, cutoff
WHERE p.role=d.role AND p.period=d.period AND p.currency='INR' AND p."effectiveUntil" IS NULL AND p.amount<>d.amount;

WITH desired(role,period,amount) AS (VALUES
 ('ADMIN'::"BillingRole",'MONTHLY'::"BillingPeriod",250::numeric),
 ('ADMIN','SIX_MONTH',1400),('ADMIN','YEARLY',2800),
 ('MANAGER','MONTHLY',200),('MANAGER','SIX_MONTH',1100),('MANAGER','YEARLY',2100),
 ('SALES','MONTHLY',150),('SALES','SIX_MONTH',800),('SALES','YEARLY',1500)
)
INSERT INTO "billing_prices"("role","period","amount","currency","effectiveFrom","createdAt")
SELECT d.role,d.period,d.amount,'INR',TIMESTAMP '2026-09-08 00:00:00',TIMESTAMP '2026-09-08 00:00:00'
FROM desired d WHERE NOT EXISTS (
 SELECT 1 FROM "billing_prices" p WHERE p.role=d.role AND p.period=d.period AND p.currency='INR' AND p."effectiveUntil" IS NULL AND p.amount=d.amount
);
