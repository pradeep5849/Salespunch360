import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";import{mobileReportActor,mobileSalesRole}from"./report-actor";import type{MobilePrincipal}from"./auth";
const principal=(role:MobilePrincipal["role"]):MobilePrincipal=>({id:"mobile",name:"Mobile",email:"m@example.com",role,managerType:role==="MANAGER"?"FIELD_MANAGER":null,companyId:"company"});
describe("temporary mobile report actor compatibility",()=>{
 it("maps only current mobile roles to explicit Sales roles",()=>{expect(mobileSalesRole("COMPANY_ADMIN")).toBe("PRIMARY_ADMIN");expect(mobileSalesRole("MANAGER")).toBe("MANAGER");expect(mobileSalesRole("SALES")).toBe("SALES")});
 it("does not introduce unsupported mobile identities",()=>{expect(()=>mobileSalesRole("FIELD_ADMIN" as never)).toThrow("MOBILE_UNAUTHORIZED");expect(()=>mobileSalesRole("ACCOUNT_USER" as never)).toThrow("MOBILE_UNAUTHORIZED");expect(()=>mobileSalesRole("SUPER_ADMIN" as never)).toThrow("MOBILE_UNAUTHORIZED")});
 it("builds the report actor without changing MobilePrincipal",()=>expect(mobileReportActor(principal("COMPANY_ADMIN"))).toEqual({id:"mobile",name:"Mobile",salesRole:"PRIMARY_ADMIN",managerType:null,companyId:"company"}));
 it("keeps mobile authentication independent of Sales lifecycle fields until F3M",()=>{const source=readFileSync(new URL("./auth.ts",import.meta.url),"utf8");expect(source).not.toContain("salesAccessActive");expect(source).not.toContain("salesRole");expect(source).toContain('const MOBILE_ROLES: Role[] = ["COMPANY_ADMIN", "MANAGER", "SALES"]')});
});
