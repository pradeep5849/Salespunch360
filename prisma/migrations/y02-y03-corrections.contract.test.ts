import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const schema=readFileSync("prisma/schema.prisma","utf8");
const migration=readFileSync("prisma/migrations/20260913100000_y02_y03_tenant_invariants/migration.sql","utf8");
describe("Y-02/Y-03 database invariants",()=>{
 it("makes one party target per opening journal side",()=>expect(migration).toContain('"companyId", "journalEntryId", "partyType"'));
 it("uses a tenant-aware opening target foreign key",()=>expect(migration).toMatch(/FOREIGN KEY \("companyId", "openingBalanceId"\)[\s\S]*party_opening_balances/));
 it("allows at most one current signature",()=>expect(migration).toContain('WHERE "isCurrent" = true'));
 it("uses a tenant-aware signature foreign key",()=>expect(migration).toMatch(/FOREIGN KEY \("companyId", "signatureVersionId"\)[\s\S]*authorized_signature_versions/));
 it("models both composite relations",()=>{expect(schema).toContain('fields: [companyId, openingBalanceId]');expect(schema).toContain('fields: [companyId, signatureVersionId]')});
});
