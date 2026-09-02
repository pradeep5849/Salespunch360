CREATE TYPE "TravelApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "companies"
  ADD COLUMN "travelRatePerKm" DECIMAL(10,2);

ALTER TABLE "users"
  ADD COLUMN "travelAllowanceEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "travelRatePerKm" DECIMAL(10,2);

CREATE TABLE "daily_travel_approvals" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "businessDate" DATE NOT NULL,
  "distanceMeters" INTEGER NOT NULL,
  "ratePerKm" DECIMAL(10,2) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "status" "TravelApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" UUID,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "daily_travel_approvals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_travel_approvals_companyId_employeeId_businessDate_key"
  ON "daily_travel_approvals"("companyId","employeeId","businessDate");
CREATE INDEX "daily_travel_approvals_companyId_businessDate_status_idx"
  ON "daily_travel_approvals"("companyId","businessDate","status");
CREATE INDEX "daily_travel_approvals_employeeId_businessDate_idx"
  ON "daily_travel_approvals"("employeeId","businessDate");

ALTER TABLE "daily_travel_approvals"
  ADD CONSTRAINT "daily_travel_approvals_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "daily_travel_approvals"
  ADD CONSTRAINT "daily_travel_approvals_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "daily_travel_approvals"
  ADD CONSTRAINT "daily_travel_approvals_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
