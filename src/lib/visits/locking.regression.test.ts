import{describe,expect,it}from"vitest";
import{readFileSync}from"node:fs";
const source=readFileSync(new URL("./service.ts",import.meta.url),"utf8");
describe("check-in transaction locks",()=>{
 it("projects an integer while forcing the advisory lock CTE to execute",()=>{expect(source).toContain('WITH "phone_lock" AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${key}))) SELECT 1::int AS "locked" FROM "phone_lock"');expect(source).not.toMatch(/\$queryRaw`SELECT pg_advisory_xact_lock/);});
 it("projects only supported integer scalars from every visit row lock",()=>{const locks=[...source.matchAll(/\$queryRaw(?:<[^`]+>)?`([^`]+FOR UPDATE)`/g)].map(match=>match[1]);expect(locks).toHaveLength(4);for(const sql of locks){expect(sql).toContain('SELECT 1::int AS "locked"');expect(sql).not.toContain('SELECT "id"');}});
 it("takes the repaired lock before NEW phone deduplication",()=>expect(source).toMatch(/if\(phone\)\{await lockPhone\(tx,user\.companyId\+"\|"\+phone\);const matches=await tx\.lead\.findMany/));
 it("keeps FOLLOW_UP and CUSTOMER row locks before scoped reads",()=>{expect(source).toMatch(/visitType==="CUSTOMER"\)\{\s*await tx\.\$queryRaw[\s\S]*?FOR UPDATE`;\s*const customer=await tx\.customer\.findFirst/);expect(source).toMatch(/visitType==="FOLLOW_UP"\)\{\s*await tx\.\$queryRaw[\s\S]*?FOR UPDATE`;\s*const lead=await tx\.lead\.findFirst/);});
 it("takes the repaired lock before addPhoneToVisit deduplication",()=>expect(source).toMatch(/addPhoneToVisit[\s\S]*?await lockPhone\(tx,user\.companyId\+"\|"\+phone\);const visit=[\s\S]*?tx\.lead\.findFirst/));
 it("retains serializable check-in isolation and lock-before-dedup ordering",()=>{expect(source).toContain('isolationLevel:Prisma.TransactionIsolationLevel.Serializable');expect(source.indexOf('await lockPhone(tx,user.companyId+"|"+phone)')).toBeLessThan(source.indexOf('const matches=await tx.lead.findMany'));});
});
