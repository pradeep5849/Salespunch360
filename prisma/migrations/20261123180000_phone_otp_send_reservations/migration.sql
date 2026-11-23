-- SMS reservations are stored without raw phone numbers.
-- The future send endpoint must lock a per-number key in a transaction before
-- reading the rolling window and inserting a reservation.
CREATE TABLE "phone_otp_sends" (
  "id" UUID NOT NULL,
  "phoneHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "phone_otp_sends_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "phone_otp_sends_phoneHash_createdAt_idx"
  ON "phone_otp_sends"("phoneHash", "createdAt");
