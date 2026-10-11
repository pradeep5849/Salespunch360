-- Preserve existing schedules; their current due date is the earliest available anchor.
ALTER TABLE "recurring_expense_templates" ADD COLUMN "anchorDate" DATE, ADD COLUMN "creationRequestKey" UUID;
UPDATE "recurring_expense_templates" SET "anchorDate" = "nextDueDate";
CREATE UNIQUE INDEX "recurring_expense_templates_companyId_creationRequestKey_key" ON "recurring_expense_templates"("companyId", "creationRequestKey");
