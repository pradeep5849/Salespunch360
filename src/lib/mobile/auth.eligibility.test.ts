import { describe, expect, it } from "vitest";
import type { ProductEdition, Role, SalesRole } from "@prisma/client";
import { isMobileEligible, mobileCan, mobileFieldWorkEnabled, type MobilePrincipal } from "./auth";

const identity=(overrides:Partial<{isActive:boolean;companyId:string|null;role:Role;salesRole:SalesRole|null;accountRole:"ACCOUNT_ADMIN"|null;salesAccessActive:boolean;accountAccessActive:boolean;managerType:null}>={})=>({isActive:true,companyId:"company",role:"SALES" as Role,salesRole:"SALES" as SalesRole|null,accountRole:null,salesAccessActive:true,accountAccessActive:false,managerType:null,...overrides});
const principal=(salesRole:SalesRole,managerType:"FIELD_MANAGER"|"MANAGER_ONLY"|null=null):MobilePrincipal=>({id:"user",name:"User",email:"u@example.com",companyId:"company",salesRole,managerType});

describe("canonical mobile eligibility",()=>{
  it.each(["PRIMARY_ADMIN","ADMIN","MANAGER","SALES"] as const)("allows active Sales identity %s",salesRole=>expect(isMobileEligible(identity({salesRole}),"SALESPUNCH360")).toBe(true));
  it.each(["PRIMARY_ADMIN","ADMIN","MANAGER","SALES"] as const)("denies inactive or Sales-suspended %s",salesRole=>{expect(isMobileEligible(identity({salesRole,isActive:false}),"SALESPUNCH360")).toBe(false);expect(isMobileEligible(identity({salesRole,salesAccessActive:false}),"SALESPUNCH360")).toBe(false)});
  it.each(["COMPANY_ADMIN","FIELD_ADMIN","MANAGER","SALES"] as const)("legacy %s cannot authorize without salesRole",role=>expect(isMobileEligible(identity({role,salesRole:null}),"SALESPUNCH360")).toBe(false));
  it("authorizes each edition only from active workspace grants",()=>{
    const account=identity({role:"ACCOUNT_USER",salesRole:null,salesAccessActive:false,accountRole:"ACCOUNT_ADMIN",accountAccessActive:true});
    expect(isMobileEligible(identity(),"SALESPUNCH360")).toBe(true);
    expect(isMobileEligible(account,"SALESPUNCH360_ACCOUNT")).toBe(true);
    expect(isMobileEligible(identity(),"SALESPUNCH360_PLUS")).toBe(true);
    expect(isMobileEligible(account,"SALESPUNCH360_PLUS")).toBe(true);
    expect(isMobileEligible(identity({accountRole:"ACCOUNT_ADMIN",accountAccessActive:true}),"SALESPUNCH360_PLUS")).toBe(true);
    expect(isMobileEligible(account,"SALESPUNCH360")).toBe(false);
    expect(isMobileEligible(identity(),"SALESPUNCH360_ACCOUNT" as ProductEdition)).toBe(false);
  });
  it("fails closed without a workspace and for inactive, missing-tenant, or SUPER_ADMIN identities",()=>{expect(isMobileEligible(identity({salesAccessActive:false}),"SALESPUNCH360_PLUS")).toBe(false);expect(isMobileEligible(identity({isActive:false}),"SALESPUNCH360")).toBe(false);expect(isMobileEligible(identity({companyId:null}),"SALESPUNCH360")).toBe(false);expect(isMobileEligible(identity({role:"SUPER_ADMIN",salesRole:"PRIMARY_ADMIN"}),"SALESPUNCH360_PLUS")).toBe(false)});
  it("keeps admin permissions canonical",()=>{expect(mobileCan(principal("ADMIN"),"SALES_USER_ADMIN")).toBe(false);expect(mobileCan(principal("ADMIN"),"SALES_SETTINGS")).toBe(false);expect(mobileCan(principal("ADMIN"),"SALES_BILLING")).toBe(false);expect(mobileCan(principal("PRIMARY_ADMIN"),"SALES_SETTINGS")).toBe(true);expect(mobileCan(principal("PRIMARY_ADMIN"),"SALES_BILLING")).toBe(true)});
  it("allows field work only for Field Manager and Sales",()=>{expect(mobileFieldWorkEnabled(principal("MANAGER","FIELD_MANAGER"))).toBe(true);expect(mobileFieldWorkEnabled(principal("SALES"))).toBe(true);expect(mobileFieldWorkEnabled(principal("MANAGER","MANAGER_ONLY"))).toBe(false);expect(mobileFieldWorkEnabled(principal("MANAGER",null))).toBe(false);expect(mobileFieldWorkEnabled(principal("PRIMARY_ADMIN"))).toBe(false);expect(mobileFieldWorkEnabled(principal("ADMIN"))).toBe(false)});
});
