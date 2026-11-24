-- Additive rollout: existing accounts retain their login and unverified phone fields.
ALTER TABLE "users"
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "firebasePhoneUid" VARCHAR(128);

CREATE UNIQUE INDEX "users_firebasePhoneUid_key"
  ON "users"("firebasePhoneUid");

-- Only verified numbers must be globally unique; existing unverified
-- employee phone values are intentionally not affected by this constraint.
CREATE UNIQUE INDEX "users_verified_phone_unique"
  ON "users"("phone")
  WHERE "phoneVerifiedAt" IS NOT NULL AND "phone" IS NOT NULL;
