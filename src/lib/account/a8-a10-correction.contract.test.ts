import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(path, "utf8");
describe("A8-A10 correction contracts", () => {
  it("keeps project profitability tax-exclusive", () => {
    const source = read("src/lib/account/project-costing.ts");
    expect(source).toContain("taxableTotal");
    expect(source).toContain("taxableAmount");
    expect(source).not.toContain('SUBCONTRACT_PURCHASE"]).map');
  });
  it("provides a non-financial PO finalizer and source selector", () => {
    expect(read("src/lib/account/commercial.ts")).toContain(
      "finalizeNonFinancialDocument",
    );
    expect(
      read("src/app/workspace/account/transactions/new/commercial-editor.tsx"),
    ).toContain("Source Purchase Order (optional)");
  });
  it("adds forward-only loan idempotency", () => {
    const sql = read(
      "prisma/migrations/20260911200000_a8_a10_accounting_scope_corrections/migration.sql",
    );
    expect(sql).toContain("loans_companyId_idempotencyKey_key");
    expect(sql).not.toMatch(/session_replication_role|UPDATE\s+/i);
  });
  it("exposes permission-gated navigation", () => {
    const account = read("src/app/workspace/account/page.tsx"),
      project = read("src/app/workspace/account/projects/[id]/page.tsx");
    expect(account).toContain("Expenses & Other Income");
    expect(account).toContain("Cash, Bank, Capital & Loans");
    expect(project).toContain("Project Costing / Profitability");
  });
});
