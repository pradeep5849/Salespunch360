import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260908000000_workspace_lifecycle/migration.sql"), "utf8");

describe("F3B workspace lifecycle migration contract", () => {
  it("adds both lifecycle columns as non-null and inactive by default", () => {
    expect(migration).toContain('"salesAccessActive" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('"accountAccessActive" BOOLEAN NOT NULL DEFAULT false');
  });

  it("backfills access only for active identities in compatible editions", () => {
    expect(migration).toContain('u."isActive" = true');
    expect(migration).toContain('u."salesRole" IS NOT NULL');
    expect(migration).toContain("c.\"productEdition\" IN ('SALESPUNCH360', 'SALESPUNCH360_PLUS')");
    expect(migration).toContain('u."accountRole" IS NOT NULL');
    expect(migration).toContain("c.\"productEdition\" IN ('SALESPUNCH360_ACCOUNT', 'SALESPUNCH360_PLUS')");
  });

  it("requires company membership and a corresponding role without coupling to global activity", () => {
    expect(migration).toContain('NOT "salesAccessActive" OR ("companyId" IS NOT NULL AND "salesRole" IS NOT NULL)');
    expect(migration).toContain('NOT "accountAccessActive" OR ("companyId" IS NOT NULL AND "accountRole" IS NOT NULL)');
    const constraints = migration.slice(migration.indexOf("ALTER TABLE \"users\" ADD CONSTRAINT"));
    expect(constraints).not.toContain('"isActive"');
  });
});
