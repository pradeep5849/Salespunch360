-- Additive, nullable Account-only settings. Existing companies retain all current behaviour.
ALTER TABLE "account_settings" ADD COLUMN "itemSettings" JSONB;
