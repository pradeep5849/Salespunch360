import {describe,expect,it} from "vitest";import fs from "node:fs";const migration=fs.readFileSync("prisma/migrations/20260910020000_a3_quotation_estimate_boq/migration.sql","utf8"),schema=fs.readFileSync("prisma/schema.prisma","utf8");
describe("A3 migration hardening contract",()=>{
 it("is explicitly transactional",()=>{expect(migration.startsWith("BEGIN;")).toBe(true);expect(migration.trimEnd().endsWith("COMMIT;")).toBe(true)});
 it("has same-company Customer and Lead FKs",()=>{expect(migration).toMatch(/FOREIGN KEY \("companyId", "customerId"\) REFERENCES "customers"\("companyId", "id"\)/);expect(migration).toMatch(/FOREIGN KEY \("companyId", "sourceLeadId"\) REFERENCES "leads"\("companyId", "id"\)/)});
 it("requires exactly one document source",()=>expect(migration).toContain('("customerId" IS NOT NULL)::int + ("sourceLeadId" IS NOT NULL)::int = 1'));
 it("uses Decimal quantity and money",()=>{expect(schema).toContain("@db.Decimal(18, 4)");expect(schema).toContain("@db.Decimal(18, 2)")});
 it("enforces branch-safe numbers, revisions and hashes",()=>{expect(schema).toContain("@@unique([companyId, branchId, documentType, documentNumber])");expect(schema).toContain("@@unique([documentId, revisionNumber])");expect(schema).toMatch(/tokenHash\s+String\s+@unique/)});
 it("allows Draft revision deletion",()=>expect(migration).toContain("OLD.status = 'DRAFT' THEN RETURN OLD"));
 it("makes pending and issued commercial data immutable",()=>expect(migration).toContain("IF OLD.status <> 'DRAFT' AND"));
 it("checks child INSERT NEW parent",()=>expect(migration).toContain("SELECT status, \"companyId\" INTO new_status, new_company"));
 it("checks UPDATE OLD and NEW parents",()=>{expect(migration).toContain("TG_OP IN ('UPDATE','DELETE')");expect(migration).toContain("OLD.\"companyId\" <> NEW.\"companyId\"")});
 it("requires every child parent to be Draft",()=>expect(migration).toContain("new_status <> 'DRAFT'"));
 it("scopes cleanup bypass to the matching Company",()=>expect(migration).toContain("cleanup_company = OLD.\"companyId\"::text"));
 it("protects essential document lifecycle transitions",()=>{expect(migration).toContain("protect_quotation_document_lifecycle");expect(migration).toContain("INVALID_QUOTATION_DOCUMENT_TRANSITION")});
 it("allows new revision document transition only with an increment",()=>expect(migration).toContain('NEW."currentRevisionNumber"=OLD."currentRevisionNumber"+1'));
 it("keeps audits append-only with tenant-exact cleanup",()=>{expect(migration).toContain("QUOTATION_AUDIT_APPEND_ONLY");expect(migration).toContain("app.account_cleanup_company_id")});
});
