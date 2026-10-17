import {beforeEach,it,expect,vi} from "vitest";
import {Prisma} from "@prisma/client";
const m=vi.hoisted(()=>({accounts:vi.fn(),groups:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{moneyAccount:{findMany:m.accounts},journalLine:{groupBy:m.groups}}}));
vi.mock("@/lib/auth/authorization",()=>({AuthorizationError:class extends Error{},requirePermission:vi.fn()}));
import {runFinancialReportForActor} from "./service";
import type {ProjectActor} from "../projects";
const actor={id:"actor",companyId:"company",accountRole:"ACCOUNT_ADMIN",branchAccessScope:"SELECTED_BRANCHES",branchIds:["branch"]} as ProjectActor;
const D=Prisma.Decimal;
beforeEach(()=>{vi.clearAllMocks();m.accounts.mockResolvedValue([{name:"Bank",ledgerAccountId:"bank"}]);m.groups.mockResolvedValue([])});
it("filters account type inside authorized company/branch reads and computes the opening equation",async()=>{
 m.groups.mockResolvedValueOnce([{ledgerAccountId:"bank",_sum:{debit:new D(1000),credit:new D(100)}}]).mockResolvedValueOnce([{ledgerAccountId:"bank",_sum:{debit:new D(200),credit:new D(50)}}]);
 const r=await runFinancialReportForActor(actor,"cash-bank",{accountType:"BANK",from:"2026-10-01",to:"2026-10-31"});
 expect(m.accounts).toHaveBeenCalledWith({where:{companyId:"company",type:"BANK",OR:[{branchId:null},{branchId:{in:["branch"]}}]}});expect(r.rows).toEqual([["Bank","900","200","50","1050"]]);expect(r.summary?.map(x=>x.value)).toEqual(["900","200","50","1050"]);
 for(const call of m.groups.mock.calls)expect(call[0].where).toMatchObject({companyId:"company",ledgerAccountId:{in:["bank"]},journalEntry:{branchId:{in:["branch"]}}});
});
it("accepts all three supported account classes and rejects invented type/filter scopes",async()=>{for(const accountType of ["CASH","BANK","PETTY_CASH"])await expect(runFinancialReportForActor(actor,"cash-bank",{accountType})).resolves.toMatchObject({title:"Cash / Bank Book"});await expect(runFinancialReportForActor(actor,"cash-bank",{accountType:"EQUITY"})).rejects.toThrow();await expect(runFinancialReportForActor(actor,"profit-loss",{accountType:"BANK"})).rejects.toThrow("REPORT_FILTER_NOT_SUPPORTED")});
it("keeps empty scopes as four zero summaries without guessing opening balances",async()=>{m.accounts.mockResolvedValue([]);const r=await runFinancialReportForActor(actor,"cash-bank",{});expect(r.rows).toEqual([]);expect(r.summary?.map(x=>x.value)).toEqual(["0","0","0","0"])});
it("retains exact cents when multiple ledger aggregates exceed the default Decimal precision",async()=>{m.accounts.mockResolvedValue([{name:"One",ledgerAccountId:"one"},{name:"Two",ledgerAccountId:"two"}]);m.groups.mockResolvedValueOnce([]).mockResolvedValueOnce(["one","two"].map(ledgerAccountId=>({ledgerAccountId,_sum:{debit:new D("900719925474099999.91"),credit:new D(0)}})));const report=await runFinancialReportForActor(actor,"cash-bank",{});expect(report.summary?.find(x=>x.label==="Receipts")?.value).toBe("1801439850948199999.82");expect(report.summary?.find(x=>x.label==="Closing")?.value).toBe("1801439850948199999.82")});
