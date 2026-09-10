import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql=readFileSync("prisma/migrations/20260910000000_a1_account_core_data_foundation/migration.sql","utf8");
describe("A1 migration contract",()=>{
 it.each(["account_settings","financial_years","numbering_series","vendors","account_units","account_categories","account_products","account_services","work_categories","work_packages","custom_field_definitions"])("creates %s",table=>expect(sql).toContain(`CREATE TABLE \"${table}\"`));
 it("enforces current-year and nullable-branch uniqueness",()=>{expect(sql).toContain("financial_years_one_current");expect(sql).toContain("numbering_series_company_default_key");});
 it("retains and additively extends the Sales customer identity",()=>{expect(sql).toContain('ALTER TABLE "customers"');expect(sql).toContain('"isAccountCustomer" BOOLEAN NOT NULL DEFAULT false');expect(sql).not.toContain('DROP TABLE "customers"');});
 it("uses decimal money and tenant foreign keys",()=>{expect(sql).toContain("DECIMAL(18,2)");expect(sql.match(/FOREIGN KEY \("companyId"\)/g)?.length).toBeGreaterThanOrEqual(10);});
});
