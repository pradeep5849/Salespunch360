-- Additive Account-wide display preferences. Existing companies receive stable defaults.
ALTER TABLE "account_settings"
  ADD COLUMN "appLanguage" VARCHAR(10) NOT NULL DEFAULT 'en',
  ADD COLUMN "displayDecimalPlaces" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "dateFormat" VARCHAR(16) NOT NULL DEFAULT 'DD/MM/YYYY',
  ADD COLUMN "warnUnsavedChanges" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "appearance" VARCHAR(16) NOT NULL DEFAULT 'SYSTEM';
