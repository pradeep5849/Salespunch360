-- Optional revision-specific display name. Preserve historical customer identity and issued snapshots.
ALTER TABLE "quotation_revisions" ADD COLUMN "billingName" VARCHAR(240);
