-- Telecaller remains a distinct seat type, but new purchases are attached to the normal Sales billing order.
-- Existing active Telecaller entitlements are first co-termed to the company's current Sales subscription.
WITH current_sales AS (
  SELECT DISTINCT ON (cs."companyId") cs."companyId", cs."billingPeriod", cs."startsAt", cs."endsAt"
  FROM "company_subscriptions" cs
  LEFT JOIN "billing_orders" bo ON bo.id=cs."sourceOrderId"
  WHERE cs.status='ACTIVE'
    AND cs."endsAt">NOW()
    AND (cs."adminSeats">0 OR cs."managerSeats">0 OR cs."salesSeats">0)
    AND COALESCE(bo.provider,'')<>'ACCOUNT_PACKAGE'
  ORDER BY cs."companyId",cs."endsAt" DESC
)
UPDATE "telecaller_subscriptions" ts
SET "billingPeriod"=cs."billingPeriod"::text,
    "endsAt"=cs."endsAt",
    "updatedAt"=NOW()
FROM current_sales cs
WHERE ts."companyId"=cs."companyId"
  AND ts.status='ACTIVE'
  AND ts."endsAt">NOW();

-- A normal paid Sales order can carry a shadow Telecaller row with the same UUID.
-- The shadow row is pricing/seat metadata only; the customer pays one normal Sales order.
CREATE OR REPLACE FUNCTION sync_unified_telecaller_sales_order()
RETURNS trigger AS $$
DECLARE
  t RECORD;
  existing_id uuid;
BEGIN
  IF NEW.status='PAID' AND OLD.status IS DISTINCT FROM 'PAID' THEN
    SELECT * INTO t
    FROM "telecaller_billing_orders"
    WHERE id=NEW.id AND "paymentReference"='UNIFIED_SALES_ORDER'
    LIMIT 1;

    IF FOUND THEN
      UPDATE "telecaller_billing_orders"
      SET status='PAID',"paidAt"=COALESCE(NEW."paidAt",NOW()),"updatedAt"=NOW()
      WHERE id=NEW.id;

      SELECT id INTO existing_id
      FROM "telecaller_subscriptions"
      WHERE "companyId"=NEW."companyId"
        AND status='ACTIVE'
        AND ABS(EXTRACT(EPOCH FROM ("endsAt"-t."coTermEndsAt")))<2
      ORDER BY "endsAt" DESC
      LIMIT 1;

      IF existing_id IS NOT NULL THEN
        UPDATE "telecaller_subscriptions"
        SET seats=t."targetSeats",
            "billingPeriod"=t."billingPeriod",
            "startsAt"=LEAST("startsAt",t."coTermStartsAt"),
            "endsAt"=t."coTermEndsAt",
            "sourceOrderId"=t.id,
            "updatedAt"=NOW()
        WHERE id=existing_id;
      ELSE
        INSERT INTO "telecaller_subscriptions" (id,"companyId",status,"billingPeriod",seats,"startsAt","endsAt","sourceOrderId","createdAt","updatedAt")
        VALUES (NEW.id,NEW."companyId",'ACTIVE',t."billingPeriod",t."targetSeats",t."coTermStartsAt",t."coTermEndsAt",t.id,NOW(),NOW())
        ON CONFLICT (id) DO UPDATE SET
          seats=EXCLUDED.seats,
          status='ACTIVE',
          "billingPeriod"=EXCLUDED."billingPeriod",
          "startsAt"=EXCLUDED."startsAt",
          "endsAt"=EXCLUDED."endsAt",
          "sourceOrderId"=EXCLUDED."sourceOrderId",
          "updatedAt"=NOW();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS billing_order_sync_unified_telecaller ON "billing_orders";
CREATE TRIGGER billing_order_sync_unified_telecaller
AFTER UPDATE OF status ON "billing_orders"
FOR EACH ROW
EXECUTE FUNCTION sync_unified_telecaller_sales_order();
