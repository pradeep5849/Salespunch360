import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const service=readFileSync("src/lib/visits/service.ts","utf8");
const page=readFileSync("src/app/workspace/leads/page.tsx","utf8");

describe("pending conversion regression contracts",()=>{
 it("uses the existing phone lock and tenant phone deduplication before creating a lead",()=>{const conversion=service.slice(service.indexOf("export async function addPhoneToVisit"),service.indexOf("export async function checkout"));expect(conversion).toMatch(/SELECT 1::int AS \"locked\" FROM \"customer_visits\"[\s\S]*FOR UPDATE/);expect(conversion.indexOf('FOR UPDATE')).toBeLessThan(conversion.indexOf('lockPhone(tx,user.companyId+"|"+phone)'));expect(conversion).toContain("lockPhone(tx,user.companyId+\"|\"+phone)");expect(conversion).toContain("companyId:user.companyId,phone:{equals:phone");expect(conversion).toContain('visitType:"NEW",leadId:null')});
 it("creates the Lead and links both sides of the originating visit",()=>{const conversion=service.slice(service.indexOf("export async function addPhoneToVisit"),service.indexOf("export async function checkout"));expect(conversion).toContain("sourceVisitId:visit.id");expect(conversion).toContain("data:{leadId:lead.id,contactPhone:phone}")});
 it("keeps Pending a pseudo-view instead of a LeadStage",()=>{expect(page).toContain('q.view==="pending"');expect(page).toContain('/workspace/leads?view=pending');expect(page).not.toContain('stage:"PENDING"')});
});
