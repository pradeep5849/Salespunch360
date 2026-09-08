import { describe, expect, it } from "vitest";
import type { ProductEdition, Role, SalesRole } from "@prisma/client";
import { isMobileEligible, mobileCan, mobileFieldWorkEnabled, type MobilePrincipal } from "./auth";

const identity=(overrides:Partial<{isActive:boolean;companyId:string|null;role:Role;salesRole:SalesRole|null;salesAccessActive:boolean}>={})=>({isActive:true,companyId:"company",role:"SALES" as Role,salesRole:"SALES" as SalesRole|null,salesAccessActive:true,...overrides});
const principal=(salesRole:SalesRole,managerType:"FIELD_MANAGER"|"MANAGER_ONLY"|null=null):MobilePrincipal=>({id:"user",name:"User",email:"u@example.com",companyId:"company",salesRole,managerType});

describe("canonical mobile eligibility",()=>{
  it.each(["PRIMARY_ADMIN","ADMIN","MANAGER","SALES"] as const)("allows active Sales identity %s",salesRole=>expect(isMobileEligible(identity({salesRole}),"SALESPUNCH360")).toBe(true));
  it.each(["PRIMARY_ADMIN","ADMIN","MANAGER","SALES"] as const)("denies inactive or Sales-suspended %s",salesRole=>{expect(isMobileEligible(identity({salesRole,isActive:false}),"SALESPUNCH360")).toBe(false);expect(isMobileEligible(identity({salesRole,salesAccessActive:false}),"SALESPUNCH360")).toBe(false)});
  it.each(["COMPANY_ADMIN","FIELD_ADMIN","MANAGER","SALES"] as const)("legacy %s cannot authorize without salesRole",role=>expect(isMobileEligible(identity({role,salesRole:null}),"SALESPUNCH360")).toBe(false));
  it("fails closed for SUPER_ADMIN corruption, missing tenant, Account-only identity, and non-Sales edition",()=>{expect(isMobileEligible(identity({role:"SUPER_ADMIN",salesRole:"PRIMARY_ADMIN"}),"SALESPUNCH360")).toBe(false);expect(isMobileEligible(identity({companyId:null}),"SALESPUNCH360")).toBe(false);expect(isMobileEligible(identity({role:"ACCOUNT_USER",salesRole:null}),"SALESPUNCH360_PLUS")).toBe(false);expect(isMobileEligible(identity(),"SALESPUNCH360_ACCOUNT" as ProductEdition)).toBe(false)});
  it("keeps admin permissions canonical",()=>{expect(mobileCan(principal("ADMIN"),"SALES_USER_ADMIN")).toBe(true);expect(mobileCan(principal("ADMIN"),"SALES_SETTINGS")).toBe(false);expect(mobileCan(principal("ADMIN"),"SALES_BILLING")).toBe(false);expect(mobileCan(principal("PRIMARY_ADMIN"),"SALES_SETTINGS")).toBe(true);expect(mobileCan(principal("PRIMARY_ADMIN"),"SALES_BILLING")).toBe(true)});
  it("allows field work only for Field Manager and Sales",()=>{expect(mobileFieldWorkEnabled(principal("MANAGER","FIELD_MANAGER"))).toBe(true);expect(mobileFieldWorkEnabled(principal("SALES"))).toBe(true);expect(mobileFieldWorkEnabled(principal("MANAGER","MANAGER_ONLY"))).toBe(false);expect(mobileFieldWorkEnabled(principal("PRIMARY_ADMIN"))).toBe(false);expect(mobileFieldWorkEnabled(principal("ADMIN"))).toBe(false)});
});
