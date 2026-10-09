-- Recover an applied migration marker after an earlier transactional failure, without rewriting payment history.
BEGIN;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "manualReference" VARCHAR(100);
-- Register the earliest historical claim without altering/deleting any payment.
-- Historical duplicates retain their original records and remain reviewable.
WITH legacy AS (
 SELECT p.id,p."createdAt",UPPER(TRIM(COALESCE(
  (SELECT a.metadata->>'reference' FROM "billing_audit_events" a WHERE a."entityId"=p."orderId" AND a.type='MANUAL_PAYMENT_CONFIRMED' ORDER BY a."occurredAt" DESC LIMIT 1),
  SUBSTRING(p."providerPaymentId" FROM '^manual_[0-9a-fA-F-]{36}_(.+)$')
 ))) AS reference FROM "payment_transactions" p WHERE p.provider='MANUAL'
), ranked AS (SELECT id,reference,ROW_NUMBER() OVER(PARTITION BY reference ORDER BY "createdAt",id) AS rank FROM legacy WHERE reference IS NOT NULL AND LENGTH(reference)<=100)
UPDATE "payment_transactions" p SET "manualReference"=r.reference FROM ranked r WHERE p.id=r.id AND r.rank=1 AND p."manualReference" IS NULL AND NOT EXISTS (SELECT 1 FROM "payment_transactions" claimed WHERE claimed."manualReference"=r.reference AND claimed.id<>p.id);
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_manualReference_key" ON "payment_transactions"("manualReference");
COMMIT;
