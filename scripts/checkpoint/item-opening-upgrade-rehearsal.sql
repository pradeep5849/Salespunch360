-- Isolated local schema fixture; the runner expands migration statements without nested transaction wrappers.
BEGIN;
CREATE SCHEMA checkpoint_item_opening_upgrade;
SET LOCAL search_path = checkpoint_item_opening_upgrade;
CREATE TABLE account_products (id UUID PRIMARY KEY,"companyId" UUID NOT NULL,name TEXT,"costPrice" DECIMAL(18,2),"salePrice" DECIMAL(18,2));
INSERT INTO account_products VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','Existing item',20.25,30.50);
-- EXPAND_ITEM_OPENING_MIGRATION
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM account_products WHERE id='00000000-0000-4000-8000-000000000001' AND name='Existing item' AND "costPrice"=20.25 AND "salePrice"=30.50 AND "creationRequestKey" IS NULL AND "creationRequestHash" IS NULL AND "itemLocation" IS NULL) THEN RAISE EXCEPTION 'Legacy item values or identity changed'; END IF;
END $$;
ROLLBACK;
