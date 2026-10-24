ALTER TABLE commercial_document_lines ADD COLUMN "servicePeriodDays" INTEGER;
ALTER TABLE commercial_document_lines ADD CONSTRAINT service_period_valid CHECK ("servicePeriodDays" IS NULL OR "servicePeriodDays" BETWEEN 1 AND 3650);
CREATE TABLE service_reminder_completions (
 "companyId" UUID NOT NULL, "lineId" UUID NOT NULL, "completedById" UUID NOT NULL, "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("companyId", "lineId"),
 FOREIGN KEY ("companyId", "lineId") REFERENCES commercial_document_lines ("companyId", "id") ON DELETE CASCADE ON UPDATE RESTRICT,
 FOREIGN KEY ("companyId", "completedById") REFERENCES users ("companyId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
