-- Existing Stage 1 companies are preserved but do not receive an invented trial.
-- New self-service companies explicitly receive TRIAL and server-generated dates.
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED');

ALTER TABLE "companies"
  ADD COLUMN "trialStartedAt" TIMESTAMP(3),
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'SUSPENDED';

ALTER TABLE "companies" ADD CONSTRAINT "companies_trial_dates_check" CHECK (
  ("trialStartedAt" IS NULL AND "trialEndsAt" IS NULL) OR
  ("trialStartedAt" IS NOT NULL AND "trialEndsAt" IS NOT NULL AND "trialEndsAt" > "trialStartedAt")
);

ALTER TABLE "companies" ADD CONSTRAINT "companies_trial_status_dates_check" CHECK (
  "subscriptionStatus" <> 'TRIAL' OR ("trialStartedAt" IS NOT NULL AND "trialEndsAt" IS NOT NULL)
);

CREATE INDEX "companies_subscriptionStatus_trialEndsAt_idx"
  ON "companies"("subscriptionStatus", "trialEndsAt");
