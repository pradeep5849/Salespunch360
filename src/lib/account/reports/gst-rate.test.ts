import {beforeEach,it,expect,vi} from "vitest";
import {Prisma} from "@prisma/client";
const m=vi.hoisted(()=>({company:vi.fn(),transaction:vi.fn(),docs:vi.fn(),expenses:vi.fn(),journals:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{company:{findUnique:m.company},$transaction:m.transaction}}));
import {runFinancialReportForActor} from "./service";
import {formatReport} from "./display";
import {DEFAULT_DISPLAY_PREFERENCES} from "../display-preferences";
import type {ProjectActor} from "../projects";
const D=Prisma.Decimal,actor={id:"actor",companyId:"company",accountRole:"ACCOUNT_ADMIN",branchAccessScope:"SELECTED_BRANCHES",branchIds:["branch"]} as ProjectActor;
const line=(amount="121.50",rate="18")=>({taxRate:new D(rate),cessRate:new D(0),cgstAmount:new D(amount),sgstAmount:new D(amount),igstAmount:new D(0),cessAmount:new D(0)});
const doc=(id="sale",type="SALES_INVOICE",amount="121.50")=>({id,type,cgstTotal:new D(amount),sgstTotal:new D(amount),igstTotal:new D(0),cessTotal:new D(0),lines:[line(amount)]});
beforeEach(()=>{vi.clearAllMocks();m.company.mockResolvedValue({productEdition:"SALESPUNCH360_ACCOUNT",accountSettings:{enabledModules:[]}});m.transaction.mockImplementation(async work=>work({commercialDocument:{findMany:m.docs},expenseTransaction:{findMany:m.expenses},journalEntry:{findMany:m.journals}}));m.docs.mockResolvedValue([doc()]);m.expenses.mockResolvedValue([]);m.journals.mockResolvedValue([])});
it("matches supplied sale GST components without recalculating or swapping Tax In/Out",async()=>{
 const r=await runFinancialReportForActor(actor,"gst-rate",{});expect(r.title).toBe("GST Rate Report");expect(r.columns).toEqual(["Tax Rate","Tax Percent","Tax In","Tax Out"]);expect(r.rows).toEqual([["CGST@9%","9%","121.50","0.00"],["SGST@9%","9%","121.50","0.00"]]);expect(r.totals).toEqual(["Total","","243.00","0.00"]);expect(r.note).toContain("not eligible input tax credit");expect(m.transaction).toHaveBeenCalledWith(expect.any(Function),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
});
it("nets sales and purchase returns by component and retains separate sides",async()=>{
 m.docs.mockResolvedValue([doc(),doc("c","CREDIT_NOTE","20.01"),doc("p","PURCHASE_BILL","40"),doc("d","DEBIT_NOTE","10.01")]);const r=await runFinancialReportForActor(actor,"gst-rate",{});expect(r.rows[0]).toEqual(["CGST@9%","9%","101.49","29.99"]);expect(r.summary?.map(x=>x.value)).toEqual(["202.98","59.98"]);
});
it("keeps unallocated historical tax under unknown rate and never drops document totals",async()=>{
 m.docs.mockResolvedValue([{...doc(),cgstTotal:new D("122.50"),cessTotal:new D("0.07")}]);const r=await runFinancialReportForActor(actor,"gst-rate",{});expect(r.rows).toContainEqual(["CGST (document adjustment)","","1.00","0.00"]);expect(r.rows).toContainEqual(["CESS (document adjustment)","","0.07","0.00"]);expect(r.totals?.[2]).toBe("244.07");
});
it("includes only expense tax with an effective posted journal at cutoff",async()=>{
 m.docs.mockResolvedValue([]);m.expenses.mockResolvedValue([{id:"eligible",journalEntryId:"posted",...line("1.01")},{id:"reversed",journalEntryId:"gone",...line("50")}]);m.journals.mockResolvedValue([{id:"posted"}]);const r=await runFinancialReportForActor(actor,"gst-rate",{from:"2026-10-01",to:"2026-10-21"});expect(r.totals).toEqual(["Total","","0.00","2.02"]);expect(m.expenses.mock.calls[0][0].where).toMatchObject({companyId:"company",branchId:{in:["branch"]},status:{in:["POSTED","REVERSED"]},type:{not:"OTHER_INCOME"},transactionDate:{gte:new Date("2026-10-01"),lte:new Date("2026-10-21")}});expect(m.journals.mock.calls[0][0].where).toMatchObject({companyId:"company",branchId:{in:["branch"]},entryDate:{lte:new Date("2026-10-21")},OR:expect.any(Array)});
});
it("enforces tenant branch economic and date scope with stable page cursors",async()=>{
 m.docs.mockResolvedValueOnce(Array.from({length:1000},(_,i)=>doc(String(i)))).mockResolvedValueOnce([]);await runFinancialReportForActor(actor,"gst-rate",{from:"2026-10-01",to:"2026-10-21"});expect(m.docs.mock.calls[0][0].where).toMatchObject({companyId:"company",branchId:{in:["branch"]},status:{in:["POSTED","CANCELLED"]},journalEntry:{is:expect.any(Object)},issueDate:{gte:new Date("2026-10-01"),lte:new Date("2026-10-21")}});expect(m.docs.mock.calls[1][0]).toMatchObject({cursor:{id:"999"},skip:1});
});
it("rejects unsupported filters roles and non-account edition before financial reads",async()=>{
 await expect(runFinancialReportForActor({...actor,accountRole:"PROJECT_MANAGER"},"gst-rate",{})).rejects.toThrow();await expect(runFinancialReportForActor(actor,"gst-rate",{productId:"11111111-1111-4111-8111-111111111111"})).rejects.toThrow("REPORT_FILTER_NOT_SUPPORTED");m.company.mockResolvedValue({productEdition:"SALESPUNCH360",accountSettings:null});await expect(runFinancialReportForActor(actor,"gst-rate",{})).rejects.toThrow("MODULE_DISABLED:GST_ADVANCED");expect(m.docs).not.toHaveBeenCalled();expect(m.expenses).not.toHaveBeenCalled();
});
it("preserves exact large decimals and formats money but not tax percentages",async()=>{
 m.docs.mockResolvedValue([doc("large","SALES_INVOICE","9007199254740999.91")]);const r=await runFinancialReportForActor(actor,"gst-rate",{});expect(r.totals?.[2]).toBe("18014398509481999.82");const formatted=formatReport(r,{...DEFAULT_DISPLAY_PREFERENCES,baseCurrency:"USD"});expect(formatted.rows[0][1]).toBe("9%");expect(formatted.rows[0][2]).toContain("$");expect(formatReport(r,DEFAULT_DISPLAY_PREFERENCES,true).rows[0][2]).toBe("9007199254740999.91");
});
it("returns honest zero totals without fabricated rate rows",async()=>{m.docs.mockResolvedValue([]);const r=await runFinancialReportForActor(actor,"gst-rate",{});expect(r.rows).toEqual([]);expect(r.totals).toEqual(["Total","","0.00","0.00"])});
