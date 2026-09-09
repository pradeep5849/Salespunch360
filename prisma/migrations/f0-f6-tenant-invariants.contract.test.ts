import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "prisma/migrations/20260909030000_f0_f6_tenant_invariant_hardening/migration.sql",
  "utf8",
);

describe("employee financial tenant invariants", () => {
  it("uses composite tenant foreign keys for every employee relationship", () => {
    for (const constraint of [
      "employee_compensation_employee_tenant_fkey",
      "employee_advances_employee_tenant_fkey",
      "employee_reimbursements_employee_tenant_fkey",
      "salary_history_employee_tenant_fkey",
    ]) {
      expect(sql).toContain(constraint);
    }
    expect(sql.match(/REFERENCES "users" \("companyId", "id"\)/g)).toHaveLength(5);
  });

  it("binds salary history to a profile for the same Company and employee", () => {
    expect(sql).toContain('FOREIGN KEY ("companyId", "employeeId", "compensationProfileId")');
    expect(sql).toContain('REFERENCES "employee_compensation_profiles" ("companyId", "employeeId", "id")');
  });

  it("rejects invalid money, periods, and partial review audit linkage", () => {
    expect(sql.match(/CHECK \("(?:baseAmount|amount)" > 0\)/g)).toHaveLength(3);
    expect(sql).toContain('"effectiveUntil" >= "effectiveFrom"');
    expect(sql).toContain('"periodEnd" >= "periodStart"');
    expect(sql).toContain('"reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL');
  });

  it("does not remove data or schema columns", () => {
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
  });
});
