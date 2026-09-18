ALTER TABLE "users"
ADD COLUMN "legalAcceptedAt" TIMESTAMP(3),
ADD COLUMN "termsVersionAccepted" VARCHAR(32),
ADD COLUMN "privacyVersionAccepted" VARCHAR(32);
