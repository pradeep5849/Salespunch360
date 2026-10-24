import {beforeEach,it,expect,vi} from "vitest";
import {Prisma} from "@prisma/client";
const m=vi.hoisted(()=>({documents:vi.fn(),costs:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{commercialDocument:{findMany:m.documents},stockMovement:{groupBy:m.costs}}}));
import {runFinancialReportForActor} from "./service";
import {formatReport} from "./display";
import {DEFAULT_DISPLAY_PREFERENCES} from "../display-preferences";
import type {ProjectActor} from "../projects";
const actor={id:"actor",companyId:"company",accountRole:"ACCOUNT_ADMIN",branchAccessScope:"SELECTED_BRANCHES",branchIds:["branch"]} as ProjectActor;
const D=Prisma.Decimal;
const document=(id:string,type="SALES_INVOICE",revenue="100",quantity="2",partyId="customer")=>({id,type,documentNumber:`DOC-${id}`,partyId,partyName:"Customer",issueDate:new Date("2026-10-18"),lines:[{id:`line-${id}`,productId:"product",itemName:"Item",unitName:"Pieces",unitSymbol:"Nos",taxableAmount:new D(revenue),quantity:new D(quantity)}]});
beforeEach(()=>{vi.clearAllMocks();m.documents.mockResolvedValue([document("sale"),document("return","CREDIT_NOTE","25","0.5")]);m.costs.mockResolvedValue([{sourceLineId:"line-sale",_sum:{totalCost:new D(60)}},{sourceLineId:"line-return",_sum:{totalCost:new D(15)}}])});
it("shows bill date/party/type without changing original profit columns or signed credits",async()=>{
 const r=await runFinancialReportForActor(actor,"invoices",{from:"2026-10-01",to:"2026-10-18"});expect(r.columns).toEqual(["Invoice","Quantity","Revenue","COGS","Profit","Margin %","Date","Party","Type"]);expect(r.rows[0]).toEqual(["DOC-sale","2.0000 Nos","100","60","40","40.00","2026-10-18","Customer","SALES_INVOICE"]);expect(r.rows[1].slice(2,5)).toEqual(["-25","-15","-10"]);expect(r.summary?.map(x=>x.value)).toEqual(["75","30"]);expect(r.rowLinks).toEqual(["/workspace/account/sales/sale","/workspace/account/transactions/return"]);expect(r.nativeRowLinks).toEqual(["/workspace/account/sales/sale","/workspace/account/sales/return"]);
});
it("uses net row scope for party summaries and keeps mixed quantities separate",async()=>{
 const docs=[document("sale"),document("return","CREDIT_NOTE","25","0.5")];docs[1].lines[0].unitSymbol="kg";m.documents.mockResolvedValue(docs);const r=await runFinancialReportForActor(actor,"customers",{});expect(r.rows[0].slice(0,5)).toEqual(["Customer","Mixed units","75","45","30"]);expect(r.summary?.map(x=>x.value)).toEqual(["75","30"]);expect(r.rowLinks).toBeUndefined();
});
it("keeps identically named parties separate by saved party identity",async()=>{
 m.documents.mockResolvedValue([document("one","SALES_INVOICE","100","1","one"),document("two","SALES_INVOICE","200","1","two")]);const r=await runFinancialReportForActor(actor,"customers",{});expect(r.rows).toHaveLength(2);expect(r.summary?.[0].value).toBe("300");
});
it("never invents a service cost and shows zero totals for no matching documents",async()=>{
 m.costs.mockResolvedValue([]);expect((await runFinancialReportForActor(actor,"invoices",{})).summary?.map(x=>x.value)).toEqual(["75","75"]);m.documents.mockResolvedValue([]);const r=await runFinancialReportForActor(actor,"invoices",{});expect(r.rows).toEqual([]);expect(r.summary?.map(x=>x.value)).toEqual(["0","0"]);
});
it("retains company/branch/period/product filters and denies restricted roles",async()=>{
 const productId="11111111-1111-4111-8111-111111111111";await runFinancialReportForActor(actor,"invoices",{from:"2026-10-01",to:"2026-10-18",productId});expect(m.documents.mock.calls[0][0]).toMatchObject({where:{companyId:"company",type:{in:["SALES_INVOICE","CREDIT_NOTE"]},issueDate:{gte:new Date("2026-10-01"),lte:new Date("2026-10-18")},branchId:{in:["branch"]},lines:{some:{productId}}},include:{lines:{where:{productId}}}});expect(m.costs.mock.calls[0][0].where).toMatchObject({companyId:"company",sourceId:{in:["sale","return"]}});await expect(runFinancialReportForActor({...actor,accountRole:"PROJECT_MANAGER"},"invoices",{})).rejects.toThrow();
});
it("formats date/money metadata and keeps summary cents exact",async()=>{
 m.documents.mockResolvedValue([document("one","SALES_INVOICE","9007199254740999.91"),document("two","SALES_INVOICE","9007199254740999.91")]);m.costs.mockResolvedValue([]);const r=await runFinancialReportForActor(actor,"invoices",{});expect(r.summary?.[0].value).toBe("18014398509481999.82");const formatted=formatReport(r,{...DEFAULT_DISPLAY_PREFERENCES,baseCurrency:"USD",dateFormat:"MM/DD/YYYY"});expect(formatted.rows[0][2]).toContain("$");expect(formatted.rows[0][6]).toBe("10/18/2026");
});
