ALTER TABLE "lead_calls"
  ADD COLUMN "dialStartedAt" TIMESTAMP(3),
  ADD COLUMN "dialEndedAt" TIMESTAMP(3),
  ADD COLUMN "dialDurationSeconds" INTEGER,
  ADD COLUMN "timingSource" TEXT;

ALTER TABLE "lead_calls"
  ADD CONSTRAINT "lead_calls_dial_duration_nonnegative"
  CHECK (
    "dialDurationSeconds" IS NULL
    OR ("dialDurationSeconds" >= 0 AND "dialDurationSeconds" <= 86400)
  );
