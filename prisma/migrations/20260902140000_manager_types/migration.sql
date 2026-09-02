-- Existing managers keep their current field-working behavior.
CREATE TYPE "ManagerType" AS ENUM ('FIELD_MANAGER', 'MANAGER_ONLY');

ALTER TABLE "users" ADD COLUMN "managerType" "ManagerType";

UPDATE "users"
SET "managerType" = 'FIELD_MANAGER'
WHERE "role" = 'MANAGER';

ALTER TABLE "users"
ADD CONSTRAINT "users_manager_type_consistency"
CHECK (
  ("role" = 'MANAGER' AND "managerType" IS NOT NULL)
  OR
  ("role" <> 'MANAGER' AND "managerType" IS NULL)
);
