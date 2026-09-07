-- F1 is additive: existing Company and User columns and operational data remain intact.
CREATE TYPE "ProductEdition" AS ENUM ('SALESPUNCH360', 'SALESPUNCH360_ACCOUNT', 'SALESPUNCH360_PLUS');
CREATE TYPE "BranchAccessScope" AS ENUM ('ALL_BRANCHES', 'SELECTED_BRANCHES');

ALTER TABLE "companies" ADD COLUMN "productEdition" "ProductEdition" NOT NULL DEFAULT 'SALESPUNCH360';
ALTER TABLE "users" ADD COLUMN "branchAccessScope" "BranchAccessScope" NOT NULL DEFAULT 'ALL_BRANCHES';

CREATE TABLE "branches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "addressLine1" TEXT, "addressLine2" TEXT, "locality" TEXT, "city" TEXT,
  "state" TEXT, "postalCode" TEXT, "country" TEXT, "phone" TEXT, "email" TEXT, "gstin" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "branches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "branches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "branches_companyId_code_key" ON "branches"("companyId", "code");
CREATE INDEX "branches_companyId_isActive_idx" ON "branches"("companyId", "isActive");
CREATE UNIQUE INDEX "branches_one_primary_per_company" ON "branches"("companyId") WHERE "isPrimary";

CREATE TABLE "user_branch_accesses" (
  "userId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_branch_accesses_pkey" PRIMARY KEY ("userId", "branchId"),
  CONSTRAINT "user_branch_accesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT "user_branch_accesses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE RESTRICT
);
CREATE INDEX "user_branch_accesses_branchId_idx" ON "user_branch_accesses"("branchId");

-- Copy legacy company contact data into exactly one Head Office only when no branch exists.
INSERT INTO "branches" ("companyId", "name", "code", "isPrimary", "isActive", "addressLine1", "addressLine2", "locality", "city", "state", "postalCode", "country", "phone", "email", "gstin", "updatedAt")
SELECT c."id", 'Head Office', 'HO', true, true, c."addressLine1", c."addressLine2", c."locality", c."city", c."state", c."postalCode", c."country", c."primaryPhone", c."contactEmail", c."gstin", CURRENT_TIMESTAMP
FROM "companies" c
WHERE NOT EXISTS (SELECT 1 FROM "branches" b WHERE b."companyId" = c."id");

-- Tenant ownership is immutable after a branch is created.
CREATE FUNCTION prevent_branch_company_id_change() RETURNS trigger AS $$
BEGIN
  IF OLD."companyId" IS DISTINCT FROM NEW."companyId" THEN RAISE EXCEPTION 'branch companyId is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER branches_company_id_immutable BEFORE UPDATE OF "companyId" ON "branches"
FOR EACH ROW EXECUTE FUNCTION prevent_branch_company_id_change();

-- A branch assignment requires a non-super-admin user in the branch's company.
CREATE FUNCTION validate_user_branch_access() RETURNS trigger AS $$
DECLARE user_company UUID; user_role "Role"; branch_company UUID;
BEGIN
  SELECT "companyId", "role" INTO user_company, user_role FROM "users" WHERE "id" = NEW."userId";
  SELECT "companyId" INTO branch_company FROM "branches" WHERE "id" = NEW."branchId";
  IF user_role = 'SUPER_ADMIN' OR user_company IS NULL OR user_company IS DISTINCT FROM branch_company THEN
    RAISE EXCEPTION 'user branch access must belong to the user company and cannot be assigned to SUPER_ADMIN';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER user_branch_access_tenant_check BEFORE INSERT OR UPDATE OF "userId", "branchId" ON "user_branch_accesses"
FOR EACH ROW EXECUTE FUNCTION validate_user_branch_access();

-- Prevent later user mutations from invalidating existing branch assignments.
CREATE FUNCTION validate_existing_user_branch_access_on_user_change() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "user_branch_accesses" uba
    JOIN "branches" b ON b."id" = uba."branchId"
    WHERE uba."userId" = NEW."id"
      AND (NEW."role" = 'SUPER_ADMIN' OR NEW."companyId" IS NULL OR b."companyId" IS DISTINCT FROM NEW."companyId")
  ) THEN
    RAISE EXCEPTION 'user update would invalidate existing branch access';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER users_branch_access_reverse_tenant_check
BEFORE UPDATE OF "companyId", "role" ON "users"
FOR EACH ROW EXECUTE FUNCTION validate_existing_user_branch_access_on_user_change();
