-- Account packages became part of combined/manual orders after the original
-- billing-order checks were created. Persist their price in the immutable order
-- snapshot and make the database checks agree with every supported order kind.
ALTER TABLE "billing_orders"
  ADD COLUMN "accountPackageUnitPrice" NUMERIC(18,2) NOT NULL DEFAULT 0;

UPDATE "billing_orders"
SET "accountPackageUnitPrice" = CASE
  WHEN "provider" = 'ACCOUNT_PACKAGE' THEN "adminUnitPrice"
  WHEN "accountPackages" > 0 THEN
    GREATEST(0, ("subtotal" -
      "adminUnitPrice" * "adminSeats" -
      "managerUnitPrice" * "managerSeats" -
      "salesUnitPrice" * "salesSeats") / "accountPackages")
  ELSE 0
END;

ALTER TABLE "billing_orders" DROP CONSTRAINT "order_seats_check";
ALTER TABLE "billing_orders" DROP CONSTRAINT "order_money_check";

ALTER TABLE "billing_orders" ADD CONSTRAINT "order_seats_check" CHECK (
  "adminSeats" BETWEEN 0 AND 10000 AND
  "managerSeats" BETWEEN 0 AND 10000 AND
  "salesSeats" BETWEEN 0 AND 10000 AND
  "accountPackages" BETWEEN 0 AND 100 AND
  ("adminSeats" + "managerSeats" + "salesSeats" > 0 OR "accountPackages" > 0)
);

ALTER TABLE "billing_orders" ADD CONSTRAINT "order_money_check" CHECK (
  "adminUnitPrice" >= 0 AND
  "managerUnitPrice" >= 0 AND
  "salesUnitPrice" >= 0 AND
  "accountPackageUnitPrice" >= 0 AND
  ("adminSeats" = 0 OR "adminUnitPrice" > 0) AND
  ("managerSeats" = 0 OR "managerUnitPrice" > 0) AND
  ("salesSeats" = 0 OR "salesUnitPrice" > 0) AND
  ("accountPackages" = 0 OR "accountPackageUnitPrice" > 0) AND
  -- subtotal may be lower than the full unit-price snapshot for a co-termed,
  -- prorated addition; application quoting remains authoritative.
  "subtotal" >= 0 AND
  "taxAmount" >= 0 AND
  "totalAmount" = "subtotal" + "taxAmount" AND
  "currency" ~ '^[A-Z]{3}$'
);

CREATE OR REPLACE FUNCTION prevent_paid_order_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='PAID' AND
   (NEW."adminSeats",NEW."managerSeats",NEW."salesSeats",NEW."accountPackages",NEW."adminUnitPrice",NEW."managerUnitPrice",NEW."salesUnitPrice",NEW."accountPackageUnitPrice",NEW.currency,NEW.subtotal,NEW."taxAmount",NEW."totalAmount")
   IS DISTINCT FROM
   (OLD."adminSeats",OLD."managerSeats",OLD."salesSeats",OLD."accountPackages",OLD."adminUnitPrice",OLD."managerUnitPrice",OLD."salesUnitPrice",OLD."accountPackageUnitPrice",OLD.currency,OLD.subtotal,OLD."taxAmount",OLD."totalAmount")
 THEN RAISE EXCEPTION 'paid order snapshot is immutable'; END IF;
 RETURN NEW;
END$$;
