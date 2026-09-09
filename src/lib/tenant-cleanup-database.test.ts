import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("./db", () => ({ db: { $transaction: database.transaction } }));

import { CLEANUP_DATABASE_STAGES, CleanupDatabaseError, classifyCleanupDatabaseError, runCleanupDatabaseStage, tenantCleanupDatabase } from "./tenant-cleanup-database";

function sqlText(query: unknown): string {
  const candidate = query as { strings?: readonly string[]; values?: readonly unknown[] };
  if (!candidate?.strings) return String(query);
  return candidate.strings.map((part, index) => `${part}${index < (candidate.values?.length ?? 0) ? sqlText(candidate.values?.[index]) : ""}`).join("");
}

function cleanupTransaction(failAfterLeadUpdate = false) {
  const statements: unknown[] = [];
  const tx = {
    $queryRaw: vi.fn(async (query: unknown) => {
      statements.push(query);
      return [{ id: "11111111-1111-4111-8111-111111111111" }];
    }),
    $executeRaw: vi.fn(async (query: unknown) => {
      statements.push(query);
      if (failAfterLeadUpdate && sqlText(query).includes('UPDATE "customers"')) throw new Error("later cleanup failure");
      return 1;
    }),
    user: { findMany: vi.fn(async () => []) },
  };
  let committed = false;
  database.transaction.mockImplementationOnce(async (work: (client: typeof tx) => Promise<unknown>) => {
    const result = await work(tx);
    committed = true;
    return result;
  });
  return { statements, wasCommitted: () => committed };
}

describe("safe cleanup database diagnostics", () => {
  it.each(CLEANUP_DATABASE_STAGES)("attributes a raw failure to %s", async stage => {
    const failure = Object.assign(new Error("password=secret SELECT private_data"), {
      code: "P2010",
      meta: { code: "23503", constraint: "orders_companyId_fkey", table: "billing_orders", message: "customer data" },
    });
    const result = runCleanupDatabaseStage(stage, async () => { throw failure; });
    await expect(result).rejects.toMatchObject({
      message: "TENANT_CLEANUP_DATABASE_FAILURE",
      stage,
      details: { prismaCode: "P2010", databaseCode: "23503", constraint: "orders_companyId_fkey", table: "billing_orders" },
    });
    await expect(result).rejects.not.toThrow(/secret|SELECT|customer data/);
  });

  it("rejects unsafe database metadata instead of logging it", () => {
    expect(classifyCleanupDatabaseError({ code: "P2010: raw SQL", meta: { code: "23503; DROP", constraint: "safe\npassword", table: "users private" } })).toEqual({
      prismaCode: undefined, databaseCode: undefined, constraint: undefined, table: undefined,
    });
  });

  it("retains an already classified inner stage", async () => {
    const error = new CleanupDatabaseError("DELETE_COMPANY", { prismaCode: "P2010", databaseCode: "23503" });
    await expect(runCleanupDatabaseStage("VERIFY_RESIDUE", async () => { throw error; })).rejects.toBe(error);
  });
});

describe("lead visit reference cleanup", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";

  it("uses one tenant-scoped atomic UPDATE compatible with leads_source_visit_check", async () => {
    const harness = cleanupTransaction();
    await tenantCleanupDatabase.withLockedTenant(companyId, locked => locked.deleteTenant(companyId));

    const leadUpdates = harness.statements.map(sqlText).filter(sql => sql.includes('UPDATE "leads"'));
    expect(leadUpdates).toHaveLength(1);
    const sql = leadUpdates[0].replace(/\s+/g, " ").trim();
    expect(sql).toContain('"source" = CASE WHEN "source" = \'CUSTOMER_VISIT\'::"LeadSource" THEN \'OTHER\'::"LeadSource" ELSE "source" END');
    expect(sql).toContain('"sourceVisitId" = NULL');
    expect(sql).toContain('"checkInReferenceVisitId" = NULL');
    expect(sql).toContain(`WHERE "companyId" = ${companyId}::uuid`);

    const updated = (source: "CUSTOMER_VISIT" | "MANUAL", sourceVisitId: string | null) => {
      expect((source === "CUSTOMER_VISIT") === (sourceVisitId !== null)).toBe(true);
      return {
        source: source === "CUSTOMER_VISIT" ? "OTHER" : source,
        sourceVisitId: null,
        checkInReferenceVisitId: null,
      };
    };
    for (const row of [updated("CUSTOMER_VISIT", "visit-id"), updated("MANUAL", null)]) {
      expect((row.source === "CUSTOMER_VISIT") === (row.sourceVisitId !== null)).toBe(true);
    }
    expect(updated("CUSTOMER_VISIT", "visit-id")).toEqual({ source: "OTHER", sourceVisitId: null, checkInReferenceVisitId: null });
    expect(updated("MANUAL", null).source).toBe("MANUAL");
  });

  it("keeps the temporary source rewrite inside the purge transaction and rolls it back on a later stage failure", async () => {
    const harness = cleanupTransaction(true);
    await expect(tenantCleanupDatabase.withLockedTenant(companyId, locked => locked.deleteTenant(companyId)))
      .rejects.toMatchObject({ stage: "CLEAR_CUSTOMER_VISIT_REFERENCE" });
    expect(harness.statements.map(sqlText).some(sql => sql.includes("'OTHER'::\"LeadSource\""))).toBe(true);
    expect(harness.wasCommitted()).toBe(false);
  });

  it("continues to attribute the constraint failure to CLEAR_LEAD_VISIT_REFERENCES", async () => {
    const failure = Object.assign(new Error("constraint violation"), { code: "P2010", meta: { code: "23514", constraint: "leads_source_visit_check" } });
    await expect(runCleanupDatabaseStage("CLEAR_LEAD_VISIT_REFERENCES", async () => { throw failure; })).rejects.toMatchObject({
      stage: "CLEAR_LEAD_VISIT_REFERENCES",
      details: { prismaCode: "P2010", databaseCode: "23514", constraint: "leads_source_visit_check" },
    });
  });
});

describe("append-only lead activity tenant purge", () => {
  const lockedCompanyId = "11111111-1111-4111-8111-111111111111";
  const otherCompanyId = "22222222-2222-4222-8222-222222222222";
  const migration = readFileSync("prisma/migrations/20260909000000_scope_append_only_tenant_purge/migration.sql", "utf8");

  it("keeps ordinary DELETE and every UPDATE blocked", () => {
    expect(migration).toContain("IF TG_OP = 'DELETE'");
    expect(migration).not.toMatch(/TG_OP\s*=\s*'UPDATE'[\s\S]+RETURN OLD/);
    expect(migration).toContain("RAISE EXCEPTION 'lead activity is append-only'");
  });

  it("permits DELETE only when the local marker exactly matches the row company", () => {
    expect(migration).toContain("current_setting('app.tenant_cleanup_company_id', true) = OLD.\"companyId\"::text");
    expect(migration).toMatch(/IF TG_OP = 'DELETE'[\s\S]+OLD\."companyId"::text[\s\S]+RETURN OLD;/);
    expect(migration).toContain("SET search_path = pg_catalog, public");
  });

  it("applies the same narrow purge gate to the other guaranteed append-only purge targets", () => {
    for (const functionName of ["prevent_geofence_event_mutation", "prevent_billing_audit_mutation"]) {
      const start = migration.indexOf(`FUNCTION public.${functionName}()`);
      expect(start).toBeGreaterThan(-1);
      const implementation = migration.slice(start, migration.indexOf("$$;", start));
      expect(implementation).toContain("IF TG_OP = 'DELETE'");
      expect(implementation).toContain("current_setting('app.tenant_cleanup_company_id', true) = OLD.\"companyId\"::text");
      expect(implementation).toContain("SET search_path = pg_catalog, public");
    }
  });

  it("uses the locked Company id for a parameterized transaction-local marker and tenant DELETE", async () => {
    const harness = cleanupTransaction();
    await tenantCleanupDatabase.withLockedTenant(otherCompanyId, locked => locked.deleteTenant(otherCompanyId));
    const statements = harness.statements.map(sqlText).map(sql => sql.replace(/\s+/g, " ").trim());
    const enable = statements.find(sql => sql.includes("set_config('app.tenant_cleanup_company_id'") && sql.includes(", true)"));
    expect(enable).toContain(lockedCompanyId);
    expect(enable).not.toContain(otherCompanyId);
    expect(statements.find(sql => sql.includes('DELETE FROM "lead_activities"'))).toContain(`"companyId"=${lockedCompanyId}::uuid`);
    expect(statements.some(sql => sql.includes("set_config('app.tenant_cleanup_company_id', '', true)"))).toBe(true);
  });

  it("does not reach marker clearing when lead activity deletion fails, leaving rollback to discard the local marker", async () => {
    const harness = cleanupTransaction();
    database.transaction.mockReset();
    const tx = {
      $queryRaw: vi.fn(async (query: unknown) => { harness.statements.push(query); return [{ id: lockedCompanyId }]; }),
      $executeRaw: vi.fn(async (query: unknown) => {
        harness.statements.push(query);
        if (sqlText(query).includes('DELETE FROM "lead_activities"')) throw new Error("append-only failure");
        return 1;
      }),
      user: { findMany: vi.fn(async () => []) },
    };
    database.transaction.mockImplementationOnce(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
    await expect(tenantCleanupDatabase.withLockedTenant(lockedCompanyId, locked => locked.deleteTenant(lockedCompanyId)))
      .rejects.toMatchObject({ stage: "DELETE_LEAD_ACTIVITIES" });
    const statements = harness.statements.map(sqlText);
    expect(statements.some(sql => sql.includes("set_config('app.tenant_cleanup_company_id'") && sql.includes(", true)"))).toBe(true);
    expect(statements.some(sql => sql.includes("set_config('app.tenant_cleanup_company_id', '', true)"))).toBe(false);
  });
});
