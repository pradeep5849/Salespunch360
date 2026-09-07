-- F2 repair: FIELD_ADMIN is the compatibility identity for paid additional Sales admins.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FIELD_ADMIN';
-- PostgreSQL requires the new enum value to be committed before it can be used below.
COMMIT;

-- Repair F2's historical additional-admin compatibility mismatch without touching primary owners.
UPDATE "users"
SET "role" = 'FIELD_ADMIN'
WHERE "role" = 'COMPANY_ADMIN' AND "salesRole" = 'ADMIN';

-- Repair employees created after F2 but before employee creation wrote the explicit Sales role.
UPDATE "users" SET "salesRole" = 'MANAGER' WHERE "role" = 'MANAGER' AND "salesRole" IS NULL;
UPDATE "users" SET "salesRole" = 'SALES' WHERE "role" = 'SALES' AND "salesRole" IS NULL;

-- Valid dual Account roles are intentionally unrestricted. This only prevents contradictory legacy/Sales identities.
ALTER TABLE "users" ADD CONSTRAINT "users_legacy_sales_role_compatibility_check" CHECK (
  ("role" = 'SUPER_ADMIN' AND "salesRole" IS NULL AND "accountRole" IS NULL) OR
  ("role" = 'COMPANY_ADMIN' AND "salesRole" = 'PRIMARY_ADMIN') OR
  ("role" = 'FIELD_ADMIN' AND "salesRole" = 'ADMIN') OR
  ("role" = 'MANAGER' AND "salesRole" = 'MANAGER') OR
  ("role" = 'SALES' AND "salesRole" = 'SALES') OR
  ("role" = 'ACCOUNT_USER' AND "salesRole" IS NULL AND "accountRole" IS NOT NULL)
);
