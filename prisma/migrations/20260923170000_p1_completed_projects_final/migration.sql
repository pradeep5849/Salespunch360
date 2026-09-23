-- P1 project workflow: user-facing Completed is final/report-only.
-- Reuse the existing CLOSED backend state because project/accounting guards
-- already treat it as immutable and exclude it from new transaction selectors.
UPDATE "projects"
SET "status" = 'CLOSED',
    "actualEndDate" = COALESCE("actualEndDate", "updatedAt"),
    "closedAt" = COALESCE("closedAt", "updatedAt")
WHERE "status" = 'COMPLETED';
