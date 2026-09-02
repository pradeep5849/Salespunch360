CREATE TYPE "FollowUpTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "follow_up_tasks" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "leadId" UUID NOT NULL,
  "assignedUserId" UUID NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "dueDate" DATE NOT NULL,
  "notes" VARCHAR(2000),
  "status" "FollowUpTaskStatus" NOT NULL DEFAULT 'PENDING',
  "completedVisitId" UUID,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "follow_up_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "follow_up_tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "follow_up_tasks_lead_tenant_fkey" FOREIGN KEY ("leadId", "companyId") REFERENCES "leads"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "follow_up_tasks_assignee_tenant_fkey" FOREIGN KEY ("assignedUserId", "companyId") REFERENCES "users"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "follow_up_tasks_creator_tenant_fkey" FOREIGN KEY ("createdByUserId", "companyId") REFERENCES "users"("id", "companyId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "follow_up_tasks_completedVisitId_fkey" FOREIGN KEY ("completedVisitId") REFERENCES "customer_visits"("id") ON DELETE SET NULL ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "follow_up_tasks_completedVisitId_key" ON "follow_up_tasks"("completedVisitId");
CREATE INDEX "follow_up_tasks_company_assignee_status_due_idx" ON "follow_up_tasks"("companyId", "assignedUserId", "status", "dueDate");
CREATE INDEX "follow_up_tasks_company_lead_status_due_idx" ON "follow_up_tasks"("companyId", "leadId", "status", "dueDate");
CREATE INDEX "follow_up_tasks_company_status_due_idx" ON "follow_up_tasks"("companyId", "status", "dueDate");

-- Lead.followUpAt was written through Prisma as a UTC instant into TIMESTAMP WITHOUT
-- TIME ZONE. Interpret it as UTC, then take its Asia/Kolkata calendar date.
INSERT INTO "follow_up_tasks" ("id", "companyId", "leadId", "assignedUserId", "createdByUserId", "dueDate", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid(), l."companyId", l."id", l."assignedUserId", l."createdByUserId",
       ((l."followUpAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date,
       'PENDING'::"FollowUpTaskStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "leads" l
WHERE l."followUpAt" IS NOT NULL;

-- Compatibility summary: midnight UTC for the earliest authoritative business date.
UPDATE "leads" l SET "followUpAt" = pending."dueDate"::timestamp
FROM (SELECT "leadId", MIN("dueDate") AS "dueDate" FROM "follow_up_tasks" WHERE "status"='PENDING' GROUP BY "leadId") pending
WHERE pending."leadId"=l."id";
