-- Fresh databases need this composite key before the existing A10 owner FK.
-- Upgraded databases already receive it from owner asset funding; leave that
-- index and every historical migration checksum unchanged.
CREATE UNIQUE INDEX IF NOT EXISTS "owner_financial_accounts_companyId_id_key"
  ON "owner_financial_accounts"("companyId", "id");
