import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("prisma/migrations/20260910010000_a2_accounting_engine/migration.sql", "utf8");
const trigger = migration.slice(migration.indexOf("CREATE FUNCTION protect_journal_lines()"), migration.indexOf("CREATE TRIGGER journal_line_draft_only"));

describe("A2 JournalLine parent immutability", () => {
  it("checks the target parent on INSERT and allows only same-company DRAFT", () => {
    expect(trigger).toContain("IF TG_OP = 'INSERT'");
    expect(trigger).toContain('id=NEW."journalEntryId"');
    expect(trigger).toContain("new_status IS DISTINCT FROM 'DRAFT'");
    expect(trigger).toContain('new_parent_company IS DISTINCT FROM NEW."companyId"');
  });
  it("checks the old parent on DELETE and allows only DRAFT", () => {
    expect(trigger).toContain("ELSIF TG_OP = 'DELETE'");
    expect(trigger).toContain('id=OLD."journalEntryId"');
    expect(trigger).toContain("old_status IS DISTINCT FROM 'DRAFT'");
    expect(trigger).toContain("RETURN OLD");
  });
  it("rejects POSTED or REVERSED to DRAFT movement by checking OLD before NEW", () => {
    const oldRead = trigger.lastIndexOf('id=OLD."journalEntryId"');
    const newRead = trigger.lastIndexOf('id=NEW."journalEntryId"');
    const oldGuard = trigger.indexOf("old_status IS DISTINCT FROM 'DRAFT'", oldRead);
    const newGuard = trigger.indexOf("new_status IS DISTINCT FROM 'DRAFT'", newRead);
    expect(oldRead).toBeGreaterThan(0);
    expect(newRead).toBeGreaterThan(oldRead);
    expect(oldGuard).toBeGreaterThan(newRead);
    expect(newGuard).toBeGreaterThan(oldGuard);
    expect(trigger).toContain("posted or reversed journal lines are immutable");
  });
  it("allows valid DRAFT updates/deletes while preventing Company changes", () => {
    expect(trigger).toContain('NEW."companyId" IS DISTINCT FROM OLD."companyId"');
    expect(trigger).toContain('new_parent_company IS DISTINCT FROM OLD."companyId"');
    expect(trigger).toContain("RETURN NEW");
    expect(trigger).toContain("RETURN OLD");
  });
  it("retains the narrow cleanup marker exception", () => {
    expect(trigger).toContain("app.account_cleanup_company_id");
    expect(trigger).toContain('marker = OLD."companyId"::text AND NEW."companyId" = OLD."companyId"');
  });
});
