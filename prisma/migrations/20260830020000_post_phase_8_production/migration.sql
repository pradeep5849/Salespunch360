-- Existing administrators predate verification and remain fully compatible.
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
UPDATE "users" SET "emailVerifiedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "role" = 'COMPANY_ADMIN';

ALTER TABLE "companies"
 ADD COLUMN "addressLine1" TEXT,
 ADD COLUMN "addressLine2" TEXT,
 ADD COLUMN "locality" TEXT,
 ADD COLUMN "city" TEXT,
 ADD COLUMN "state" TEXT,
 ADD COLUMN "postalCode" TEXT,
 ADD COLUMN "country" TEXT,
 ADD COLUMN "primaryContactName" TEXT,
 ADD COLUMN "primaryPhone" TEXT,
 ADD COLUMN "contactEmail" TEXT,
 ADD COLUMN "alternatePhone" TEXT,
 ADD COLUMN "website" TEXT,
 ADD COLUMN "gstin" TEXT,
 ADD COLUMN "pan" TEXT,
 ADD COLUMN "registrationNumber" TEXT,
 ADD COLUMN "description" TEXT;

CREATE TABLE "email_verification_tokens" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 "userId" UUID NOT NULL,
 "tokenHash" CHAR(64) NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "usedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "email_verification_tokens_user_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT,
 CONSTRAINT "email_verification_tokens_expiry_check" CHECK ("expiresAt" > "createdAt")
);
CREATE UNIQUE INDEX "email_verification_tokens_tokenHash_key" ON "email_verification_tokens"("tokenHash");
CREATE INDEX "email_verification_tokens_user_created_idx" ON "email_verification_tokens"("userId", "createdAt");
CREATE INDEX "email_verification_tokens_expires_idx" ON "email_verification_tokens"("expiresAt");
