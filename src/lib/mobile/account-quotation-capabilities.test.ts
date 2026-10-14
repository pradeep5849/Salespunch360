import {beforeEach,describe,it,expect,vi} from "vitest";
import type {MobileAppPrincipal} from "./auth";
const m=vi.hoisted(()=>({detail:vi.fn()}));
vi.mock("./account-transactions",()=>({mobileAccountActor:(u:MobileAppPrincipal)=>({...u,isActive:true,accountAccessActive:true,salesAccessActive:false})}));
vi.mock("@/lib/quotations/service",()=>({getQuotationForActor:m.detail,quotationTransitions:{DRAFT:["PENDING_APPROVAL","CANCELLED"],PENDING_APPROVAL:["APPROVED","REJECTED","CANCELLED"],APPROVED:["SENT","ACCEPTED","DECLINED","CANCELLED"]}}));
import {mobileQuotationDetail} from "./account-quotations";
const principal:MobileAppPrincipal={id:"user",name:"Fixture",email:"fixture@example.test",companyId:"company",role:"ACCOUNT_USER",accountRole:"DATA_ENTRY",salesRole:null,managerType:null,productEdition:"SALESPUNCH360_ACCOUNT",authorizedWorkspaces:["ACCOUNT"],branchAccessScope:"ALL_BRANCHES",branchIds:[]};
describe("mobile quotation detail action filtering",()=>{
 beforeEach(()=>vi.resetAllMocks());
 it("excludes approval/rejection/cancel for Data Entry on an issued pending quotation",async()=>{
  m.detail.mockResolvedValue({status:"PENDING_APPROVAL",capabilities:{canCost:false}});
  const row=await mobileQuotationDetail(principal,"quote");
  expect(row.allowedTransitions).toEqual([]);expect(row.capabilities).toMatchObject({canApprove:false,canShare:false,canEdit:false});
 });
 it("keeps Data Entry's permitted draft edit and submission",async()=>{
  m.detail.mockResolvedValue({status:"DRAFT",capabilities:{canCost:false}});
  const row=await mobileQuotationDetail(principal,"quote");
  expect(row.allowedTransitions).toEqual(["PENDING_APPROVAL","CANCELLED"]);expect(row.capabilities.canEdit).toBe(true);
 });
 it("retains accountant approval according to the existing role policy",async()=>{
  m.detail.mockResolvedValue({status:"PENDING_APPROVAL",capabilities:{canCost:true}});
  const row=await mobileQuotationDetail({...principal,accountRole:"ACCOUNTANT"},"quote");
  expect(row.allowedTransitions).toEqual(["APPROVED","REJECTED","CANCELLED"]);expect(row.capabilities.canApprove).toBe(true);
 });
});
