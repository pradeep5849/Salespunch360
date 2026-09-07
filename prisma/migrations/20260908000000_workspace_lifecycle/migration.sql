-- F3B adds workspace-specific lifecycle state without changing authorization behavior.
ALTER TABLE "users"
  ADD COLUMN "salesAccessActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "accountAccessActive" BOOLEAN NOT NULL DEFAULT false;

-- Preserve only access that the active identity's company edition already permits.
UPDATE "users" u
SET "salesAccessActive" = true
FROM "companies" c
WHERE u."companyId" = c."id"
  AND u."isActive" = true
  AND u."salesRole" IS NOT NULL
  AND c."productEdition" IN ('SALESPUNCH360', 'SALESPUNCH360_PLUS');

UPDATE "users" u
SET "accountAccessActive" = true
FROM "companies" c
WHERE u."companyId" = c."id"
  AND u."isActive" = true
  AND u."accountRole" IS NOT NULL
  AND c."productEdition" IN ('SALESPUNCH360_ACCOUNT', 'SALESPUNCH360_PLUS');

ALTER TABLE "users" ADD CONSTRAINT "users_sales_access_requires_membership_check" CHECK (
  NOT "salesAccessActive" OR ("companyId" IS NOT NULL AND "salesRole" IS NOT NULL)
);
ALTER TABLE "users" ADD CONSTRAINT "users_account_access_requires_membership_check" CHECK (
  NOT "accountAccessActive" OR ("companyId" IS NOT NULL AND "accountRole" IS NOT NULL)
);

CREATE INDEX "users_companyId_salesAccessActive_salesRole_idx"
  ON "users"("companyId", "salesAccessActive", "salesRole");
CREATE INDEX "users_companyId_accountAccessActive_accountRole_idx"
  ON "users"("companyId", "accountAccessActive", "accountRole");
