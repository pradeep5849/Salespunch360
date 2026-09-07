import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260906000000_product_edition_multi_branch_foundation/migration.sql"), "utf8");

describe("product and branch migration contract", () => {
  it("defaults legacy companies and users without restricting existing access", () => {
    expect(migration).toContain('"productEdition" "ProductEdition" NOT NULL DEFAULT \'SALESPUNCH360\'');
    expect(migration).toContain('"branchAccessScope" "BranchAccessScope" NOT NULL DEFAULT \'ALL_BRANCHES\'');
  });

  it("backfills one Head Office while preserving legacy contact fields", () => {
    expect(migration).toContain("WHERE NOT EXISTS (SELECT 1 FROM \"branches\" b WHERE b.\"companyId\" = c.\"id\")");
    for (const field of ["addressLine1", "addressLine2", "locality", "city", "state", "postalCode", "country", "primaryPhone", "contactEmail", "gstin"]) expect(migration).toContain(`c.\"${field}\"`);
  });

  it("rejects duplicate branch codes only within the same company", () => {
    expect(migration).toContain('UNIQUE INDEX "branches_companyId_code_key" ON "branches"("companyId", "code")');
  });

  it("rejects a second primary branch and branch company reassignment", () => {
    expect(migration).toContain('UNIQUE INDEX "branches_one_primary_per_company" ON "branches"("companyId") WHERE "isPrimary"');
    expect(migration).toContain("prevent_branch_company_id_change");
  });

  it("keeps user branch access unique and tenant-scoped at assignment time", () => {
    expect(migration).toContain('PRIMARY KEY ("userId", "branchId")');
    expect(migration).toContain("validate_user_branch_access");
    expect(migration).toContain("user_role = 'SUPER_ADMIN'");
    expect(migration).toContain("user_company IS DISTINCT FROM branch_company");
  });

  it("rejects user mutations that would invalidate existing branch access", () => {
    expect(migration).toContain("validate_existing_user_branch_access_on_user_change");
    expect(migration).toContain('BEFORE UPDATE OF "companyId", "role" ON "users"');
    expect(migration).toContain('JOIN "branches" b ON b."id" = uba."branchId"');
    expect(migration).toContain("NEW.\"role\" = 'SUPER_ADMIN'");
    expect(migration).toContain('NEW."companyId" IS NULL');
    expect(migration).toContain('b."companyId" IS DISTINCT FROM NEW."companyId"');
  });
});
