CREATE TYPE "VisitType" AS ENUM ('NEW', 'FOLLOW_UP', 'CUSTOMER');
ALTER TABLE "customers" ADD COLUMN "assignedUserId" UUID;
ALTER TABLE "customer_visits" ADD COLUMN "leadId" UUID,
  ADD COLUMN "visitType" "VisitType" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "contactName" VARCHAR(160), ADD COLUMN "contactPhone" VARCHAR(30),
  ADD COLUMN "photoDataUrl" TEXT;
ALTER TABLE "customers" ADD CONSTRAINT "customers_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
ALTER TABLE "customer_visits" ADD CONSTRAINT "customer_visits_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX "customers_companyId_assignedUserId_idx" ON "customers"("companyId", "assignedUserId");
CREATE INDEX "customer_visits_companyId_leadId_checkedInAt_idx" ON "customer_visits"("companyId", "leadId", "checkedInAt");
