import{readFileSync}from"node:fs";
import{describe,expect,it}from"vitest";

const migration=readFileSync(new URL("../../../prisma/migrations/20260902000000_fix_nullable_customer_visit_trigger/migration.sql",import.meta.url),"utf8");
const originalMigration=readFileSync(new URL("../../../prisma/migrations/20260828040000_stage_5_customers_visits/migration.sql",import.meta.url),"utf8");
const schema=readFileSync(new URL("../../../prisma/schema.prisma",import.meta.url),"utf8");
const service=readFileSync(new URL("./service.ts",import.meta.url),"utf8");

describe("nullable customer visit tenant trigger repair",()=>{
 it("permits a null customer only after validating the visit user company",()=>{const userCheck=migration.indexOf('IF user_company IS DISTINCT FROM NEW."companyId"');const nullableCustomerCheck=migration.indexOf('IF NEW."customerId" IS NOT NULL');expect(userCheck).toBeGreaterThan(0);expect(nullableCustomerCheck).toBeGreaterThan(userCheck);expect(migration.slice(userCheck,nullableCustomerCheck)).toContain("RAISE EXCEPTION 'visit tenant mismatch'");});
 it("validates a non-null customer's company",()=>{expect(migration).toMatch(/IF NEW\."customerId" IS NOT NULL THEN[\s\S]*?FROM "customers"[\s\S]*?customer_company IS DISTINCT FROM NEW\."companyId"[\s\S]*?RAISE EXCEPTION 'visit tenant mismatch'[\s\S]*?END IF;/);});
 it("preserves attendance company and user ownership checks",()=>{expect(migration).toMatch(/IF NEW\."attendanceId" IS NOT NULL THEN[\s\S]*?FROM "attendances"[\s\S]*?attendance_company IS DISTINCT FROM NEW\."companyId"[\s\S]*?attendance_user IS DISTINCT FROM NEW\."userId"[\s\S]*?RAISE EXCEPTION 'visit attendance ownership mismatch'/);});
 it("replaces only the function and retains the existing trigger",()=>{expect(migration).toContain("CREATE OR REPLACE FUNCTION validate_customer_visit_tenant()");expect(migration).not.toMatch(/DROP\s+TRIGGER|CREATE\s+TRIGGER/i);expect(originalMigration).toContain("CREATE TRIGGER customer_visit_tenant_check");});
 it("keeps CustomerVisit.customerId nullable in Prisma",()=>{const model=schema.slice(schema.indexOf("model CustomerVisit"),schema.indexOf("model Lead"));expect(model).toMatch(/customerId\s+String\?\s+@db\.Uuid/);});
 it("keeps standalone NEW visits without a customer assignment",()=>{const newPath=service.slice(service.indexOf('}else{name=d.name'),service.indexOf('setStage("CREATE_VISIT")'));expect(newPath).not.toContain("customerId=");expect(service).toContain("data:{id:visitId,companyId:user.companyId,userId:user.id,customerId,leadId,attendanceId");});
});
