import { describe, expect, it } from "vitest";
import { resolveWorkspaceAccess, type WorkspacePrincipal } from "./workspace-policy";

const user=(overrides:Partial<WorkspacePrincipal>={}):WorkspacePrincipal=>({companyId:"company",role:"FIELD_ADMIN",isActive:true,salesRole:"ADMIN",accountRole:"ACCOUNTANT",salesAccessActive:true,accountAccessActive:true,managerType:null,...overrides});
describe("P1 central web workspace policy",()=>{
 it("uses the actual Additional Admin projection for dual PLUS access",()=>expect(resolveWorkspaceAccess(user({salesRole:"ADMIN",accountRole:"ACCOUNTANT"}),"SALESPUNCH360_PLUS")).toMatchObject({canAccessSales:true,canAccessAccount:true,canSwitchWorkspace:true}));
 it("keeps an Additional Admin header-eligible without granting an Account switch",()=>expect(resolveWorkspaceAccess(user({accountRole:null,accountAccessActive:false}),"SALESPUNCH360_PLUS")).toMatchObject({canAccessSales:true,canAccessAccount:false,canSwitchWorkspace:false}));
 it("keeps single-product editions isolated even with stale roles",()=>{
  expect(resolveWorkspaceAccess(user(),"SALESPUNCH360","ACCOUNT")).toMatchObject({canAccessSales:true,canAccessAccount:false,canSwitchWorkspace:false,effectiveWorkspace:"SALES"});
  expect(resolveWorkspaceAccess(user(),"SALESPUNCH360_ACCOUNT","SALES")).toMatchObject({canAccessSales:false,canAccessAccount:true,canSwitchWorkspace:false,effectiveWorkspace:"ACCOUNT"});
 });
 it.each([["SALES",true,false,"SALES"],["ACCOUNT",false,true,"ACCOUNT"]] as const)("supports PLUS %s-only identities",(_,sales,account,expected)=>expect(resolveWorkspaceAccess(user({salesAccessActive:sales,accountAccessActive:account}),"SALESPUNCH360_PLUS","ACCOUNT")).toMatchObject({canSwitchWorkspace:false,effectiveWorkspace:expected}))
 it("allows a dual PLUS identity to remember either valid workspace",()=>{expect(resolveWorkspaceAccess(user(),"SALESPUNCH360_PLUS","ACCOUNT")).toMatchObject({canSwitchWorkspace:true,effectiveWorkspace:"ACCOUNT"});expect(resolveWorkspaceAccess(user(),"SALESPUNCH360_PLUS","SALES").effectiveWorkspace).toBe("SALES")});
 it("ignores invalid preference and defaults dual access to Sales",()=>expect(resolveWorkspaceAccess(user(),"SALESPUNCH360_PLUS","INVALID").effectiveWorkspace).toBe("SALES"));
 it("denies inactive and platform identities",()=>{expect(resolveWorkspaceAccess(user({isActive:false}),"SALESPUNCH360_PLUS").effectiveWorkspace).toBeNull();expect(resolveWorkspaceAccess(user({role:"SUPER_ADMIN",companyId:null}),"SALESPUNCH360_PLUS").canSwitchWorkspace).toBe(false)});
});
