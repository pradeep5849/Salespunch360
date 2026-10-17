import {beforeEach,it,expect,vi} from "vitest";
import {Prisma} from "@prisma/client";
const m=vi.hoisted(()=>({documents:vi.fn(),branch:vi.fn(),modules:vi.fn(),outstanding:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{commercialDocument:{findMany:m.documents},branch:{findFirst:m.branch}}}));
vi.mock("../modules",()=>({requireAccountModules:m.modules}));
vi.mock("../commercial",()=>({documentOutstandingsBatch:m.outstanding}));
vi.mock("@/lib/auth/authorization",()=>({AuthorizationError:class extends Error{},requirePermission:vi.fn()}));
import {runFinancialReportForActor} from "./service";
import type {ProjectActor} from "../projects";
const branch="00000000-0000-4000-8000-000000000001",vendor="00000000-0000-4000-8000-000000000002";
const actor={id:"actor",companyId:"company",accountRole:"ACCOUNT_ADMIN",branchAccessScope:"SELECTED_BRANCHES",branchIds:[branch]} as ProjectActor;
beforeEach(()=>{vi.clearAllMocks();m.modules.mockResolvedValue(undefined);m.documents.mockResolvedValue([]);m.outstanding.mockResolvedValue(new Map());m.branch.mockResolvedValue({id:branch})});
it("bounds purchase register reads by company, assigned branch, vendor and effective journal cutoff",async()=>{
 await runFinancialReportForActor(actor,"purchase-register",{from:"2026-10-01",to:"2026-10-31",vendorId:vendor});
 expect(m.modules).toHaveBeenCalledWith(actor,"PURCHASES");expect(m.outstanding).toHaveBeenCalledWith("company",[],new Date("2026-10-31"));expect(m.documents).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({companyId:"company",branchId:{in:[branch]},vendorId:vendor,type:"PURCHASE_BILL",status:{in:["POSTED","CANCELLED"]},journalEntry:expect.any(Object)})}));
});
it("rejects Purchases OFF before reading document data",async()=>{m.modules.mockRejectedValue(new Error("MODULE_DISABLED"));await expect(runFinancialReportForActor(actor,"purchase-register",{})).rejects.toThrow("MODULE_DISABLED");expect(m.documents).not.toHaveBeenCalled()});
it("rejects out-of-scope branch and Project Manager access",async()=>{await expect(runFinancialReportForActor(actor,"purchase-register",{branchId:vendor})).rejects.toThrow();await expect(runFinancialReportForActor({...actor,accountRole:"PROJECT_MANAGER"},"purchase-register",{})).rejects.toThrow();expect(m.documents).not.toHaveBeenCalled()});
it("keeps dated purchase economics and outstanding aligned while retaining source navigation",async()=>{
 const D=Prisma.Decimal;m.documents.mockResolvedValue([{id:"bill",issueDate:new Date("2026-10-13"),documentNumber:"PB-1",vendorInvoiceNumber:"V-1",partyName:"Supplier",purchasePurpose:"GENERAL_OFFICE",project:null,taxTotal:new D("27"),grandTotal:new D("177"),lines:[]}]);m.outstanding.mockResolvedValue(new Map([["bill",new D("50")]]));
 const r=await runFinancialReportForActor(actor,"purchase-register",{});expect(r.columns.at(-1)).toBe("Outstanding");expect(r.rows[0].slice(-3)).toEqual(["27","177","50"]);expect(r.rowLinks).toEqual(["/workspace/account/transactions/bill"]);expect(r.nativeRowLinks).toEqual(["/workspace/account/purchases/bill"]);expect(r.note).toContain("selected end date");
});
