CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'SALES');

CREATE TABLE "companies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "managerId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_role_company_check" CHECK (
    ("role" = 'SUPER_ADMIN' AND "companyId" IS NULL) OR
    ("role" <> 'SUPER_ADMIN' AND "companyId" IS NOT NULL)
  ),
  CONSTRAINT "users_manager_not_self_check" CHECK ("managerId" IS NULL OR "managerId" <> "id")
);

CREATE TABLE "sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_companyId_role_idx" ON "users"("companyId", "role");
CREATE INDEX "users_managerId_idx" ON "users"("managerId");
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "users" ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- Tenant ownership cannot be reassigned after creation. A deliberate data migration is required.
CREATE FUNCTION prevent_company_id_change() RETURNS trigger AS $$
BEGIN
  IF OLD."companyId" IS DISTINCT FROM NEW."companyId" THEN
    RAISE EXCEPTION 'companyId is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_company_id_immutable BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION prevent_company_id_change();

-- A manager must belong to the same tenant and have the MANAGER role.
CREATE FUNCTION validate_user_manager() RETURNS trigger AS $$
DECLARE manager_company UUID; manager_role "Role";
BEGIN
  IF NEW."managerId" IS NOT NULL THEN
    SELECT "companyId", "role" INTO manager_company, manager_role FROM "users" WHERE "id" = NEW."managerId";
    IF manager_role IS DISTINCT FROM 'MANAGER' OR manager_company IS DISTINCT FROM NEW."companyId" THEN
      RAISE EXCEPTION 'manager must be a MANAGER in the same company';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_manager_tenant_check BEFORE INSERT OR UPDATE OF "managerId", "companyId" ON "users"
FOR EACH ROW EXECUTE FUNCTION validate_user_manager();
