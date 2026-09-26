ALTER TABLE "users"
ADD COLUMN "travelApprovalMode" TEXT NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "users"
ADD CONSTRAINT "users_travelApprovalMode_check"
CHECK ("travelApprovalMode" IN ('MANUAL', 'AUTO'));
