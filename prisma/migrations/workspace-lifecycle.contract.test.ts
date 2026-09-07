import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260908000000_workspace_lifecycle/migration.sql"), "utf8");

describe("F3B workspace lifecycle migration contract", () => {
  it("adds both lifecycle columns as non-null and inactive by default", () => {
    expect(migration).toContain('"salesAccessActive" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('"accountAccessActive" BOOLEAN NOT NULL DEFAULT false');
  });

  it("backfills Sales access with the exact identity, role, company, and edition predicates", () => {
    const salesUpdate = migration.slice(migration.indexOf('UPDATE "users" u'), migration.indexOf('UPDATE "users" u', migration.indexOf('UPDATE "users" u') + 1));
    expect(salesUpdate).toContain('u."companyId" = c."id"');
    expect(salesUpdate).toContain('u."isActive" = true');
    expect(salesUpdate).toContain('u."salesRole" IS NOT NULL');
    expect(salesUpdate).toContain("c.\"productEdition\" IN ('SALESPUNCH360', 'SALESPUNCH360_PLUS')");
    expect(salesUpdate).not.toContain("SALESPUNCH360_ACCOUNT");
  });

  it("backfills Account access with the exact identity, role, company, and edition predicates", () => {
    const accountUpdate = migration.slice(migration.indexOf('UPDATE "users" u', migration.indexOf('UPDATE "users" u') + 1), migration.indexOf('ALTER TABLE "users" ADD CONSTRAINT'));
    expect(accountUpdate).toContain('u."companyId" = c."id"');
    expect(accountUpdate).toContain('u."isActive" = true');
    expect(accountUpdate).toContain('u."accountRole" IS NOT NULL');
    expect(accountUpdate).toContain("c.\"productEdition\" IN ('SALESPUNCH360_ACCOUNT', 'SALESPUNCH360_PLUS')");
    expect(accountUpdate).not.toContain("'SALESPUNCH360',");
  });

  it("requires company membership and a corresponding role without coupling to global activity", () => {
    expect(migration).toContain('NOT "salesAccessActive" OR ("companyId" IS NOT NULL AND "salesRole" IS NOT NULL)');
    expect(migration).toContain('NOT "accountAccessActive" OR ("companyId" IS NOT NULL AND "accountRole" IS NOT NULL)');
    const constraints = migration.slice(migration.indexOf("ALTER TABLE \"users\" ADD CONSTRAINT"));
    expect(constraints).not.toContain('"isActive"');
  });

  it("creates both active-workspace composite indexes", () => {
    expect(migration).toContain('ON "users"("companyId", "salesAccessActive", "salesRole")');
    expect(migration).toContain('ON "users"("companyId", "accountAccessActive", "accountRole")');
  });
});
