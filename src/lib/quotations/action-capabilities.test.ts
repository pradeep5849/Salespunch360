import {describe,it,expect} from "vitest";
import {quotationActionCapabilities,permittedQuotationTransitions} from "./action-capabilities";
import type {AccountRole} from "@prisma/client";
const actor=(accountRole:AccountRole)=>({role:"ACCOUNT_USER" as const,isActive:true,companyId:"company",accountRole,accountAccessActive:true,salesAccessActive:false,salesRole:null,managerType:null});
describe("quotation role and state action controls",()=>{
 it("preserves approval permissions for admin accountant and project manager",()=>{
  for(const role of ["ACCOUNT_ADMIN","ACCOUNTANT","PROJECT_MANAGER"] as const) {
   const targets=permittedQuotationTransitions(actor(role),"PENDING_APPROVAL",["APPROVED","REJECTED","CANCELLED"]);
   expect(targets).toEqual(["APPROVED","REJECTED","CANCELLED"]);
  }
 });
 it("offers Data Entry draft edit/submission but no issued lifecycle or sharing",()=>{
  expect(quotationActionCapabilities(actor("DATA_ENTRY"),"DRAFT")).toMatchObject({canEdit:true,canShare:false,canLifecycle:true,canApprove:false});
  expect(permittedQuotationTransitions(actor("DATA_ENTRY"),"DRAFT",["PENDING_APPROVAL","CANCELLED"])).toEqual(["PENDING_APPROVAL","CANCELLED"]);
  expect(permittedQuotationTransitions(actor("DATA_ENTRY"),"PENDING_APPROVAL",["APPROVED","REJECTED","CANCELLED"])).toEqual([]);
 });
 it("keeps revision eligibility distinct from immutable issued-document editing",()=>{
  expect(quotationActionCapabilities(actor("ACCOUNT_ADMIN"),"SENT")).toMatchObject({canEdit:false,canRevise:true,canShare:true});
  for(const status of ["ACCEPTED","CANCELLED"] as const)expect(quotationActionCapabilities(actor("ACCOUNT_ADMIN"),status)).toMatchObject({canEdit:false,canRevise:false,canShare:false});
 });
 it("returns no mutations for an inactive identity or unavailable Account workspace",()=>{
  expect(permittedQuotationTransitions({...actor("ACCOUNT_ADMIN"),isActive:false},"DRAFT",["CANCELLED"])).toEqual([]);
  expect(quotationActionCapabilities(actor("ACCOUNT_ADMIN"),"DRAFT","SALESPUNCH360")).toMatchObject({canEdit:false,canShare:false,canLifecycle:false});
 });
});
