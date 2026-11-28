-- No emails, phone numbers, customer names, source IDs, or event payloads are stored.
-- SHA-256 receipt keys provide cross-device, concurrent delivery deduplication.
CREATE TABLE "analytics_event_receipts" (
  "keyHash" CHAR(64) PRIMARY KEY,
  "eventName" VARCHAR(32) NOT NULL,
  "context" VARCHAR(32),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3)
);
CREATE INDEX "analytics_event_receipts_createdAt_idx" ON "analytics_event_receipts"("createdAt");
ALTER TABLE "analytics_event_receipts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "analytics_event_receipts" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "analytics_event_receipts" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "analytics_event_receipts" FROM authenticated;
  END IF;
END $$;
