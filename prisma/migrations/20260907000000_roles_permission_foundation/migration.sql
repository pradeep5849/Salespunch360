-- F2 is additive: legacy Role remains the compatibility identity while workspace roles migrate independently.
ALTER TYPE "Role" ADD VALUE 'ACCOUNT_USER';
CREATE TYPE "SalesRole" AS ENUM ('PRIMARY_ADMIN', 'ADMIN', 'MANAGER', 'SALES');
CREATE TYPE "AccountRole" AS ENUM ('ACCOUNT_ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER', 'DATA_ENTRY');
ALTER TYPE "BillingRole" ADD VALUE 'ADMIN';
-- PostgreSQL requires the new enum value to be committed before billing prices can use it.
COMMIT;

ALTER TABLE "users" ADD COLUMN "salesRole" "SalesRole";
ALTER TABLE "users" ADD COLUMN "accountRole" "AccountRole";
CREATE INDEX "users_companyId_salesRole_idx" ON "users"("companyId", "salesRole");
CREATE INDEX "users_companyId_accountRole_idx" ON "users"("companyId", "accountRole");

-- Legacy tenant identities receive only their equivalent Sales role. SUPER_ADMIN remains workspace-less.
-- In the unexpected case of historical duplicate COMPANY_ADMIN records, the oldest is retained as
-- PRIMARY_ADMIN and the others become paid ADMINs; no arbitrary duplicate primary is created.
WITH ranked_admins AS (
  SELECT "id", row_number() OVER (PARTITION BY "companyId" ORDER BY "createdAt", "id") AS rank
  FROM "users" WHERE "role" = 'COMPANY_ADMIN' AND "companyId" IS NOT NULL
)
UPDATE "users" u SET "salesRole" = CASE
  WHEN u."role" = 'COMPANY_ADMIN' AND ranked_admins.rank = 1 THEN 'PRIMARY_ADMIN'::"SalesRole"
  WHEN u."role" = 'COMPANY_ADMIN' THEN 'ADMIN'::"SalesRole"
  WHEN u."role" = 'MANAGER' THEN 'MANAGER'::"SalesRole"
  WHEN u."role" = 'SALES' THEN 'SALES'::"SalesRole"
  ELSE NULL
END
FROM ranked_admins
WHERE u."id" = ranked_admins."id";
UPDATE "users" SET "salesRole" = 'MANAGER' WHERE "role" = 'MANAGER' AND "salesRole" IS NULL;
UPDATE "users" SET "salesRole" = 'SALES' WHERE "role" = 'SALES' AND "salesRole" IS NULL;

-- Exactly one Sales PRIMARY_ADMIN can exist in a company. Account roles deliberately have no cross-workspace implication.
CREATE UNIQUE INDEX "users_one_sales_primary_admin_per_company"
ON "users"("companyId") WHERE "salesRole" = 'PRIMARY_ADMIN';

-- Additive current prices; existing Manager/Sales price rows remain valid and unchanged.
INSERT INTO "billing_prices" ("id", "role", "period", "amount", "currency", "effectiveFrom", "effectiveUntil", "createdByUserId", "createdAt") VALUES
('52000000-0000-4000-8000-000000000001', 'ADMIN', 'MONTHLY', 250.00, 'INR', CURRENT_TIMESTAMP, NULL, NULL, CURRENT_TIMESTAMP),
('52000000-0000-4000-8000-000000000002', 'ADMIN', 'SIX_MONTH', 1400.00, 'INR', CURRENT_TIMESTAMP, NULL, NULL, CURRENT_TIMESTAMP),
('52000000-0000-4000-8000-000000000003', 'ADMIN', 'YEARLY', 2800.00, 'INR', CURRENT_TIMESTAMP, NULL, NULL, CURRENT_TIMESTAMP);
