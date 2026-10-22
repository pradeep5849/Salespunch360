import {beforeEach,expect,it,vi} from "vitest";
import {Prisma} from "@prisma/client";
const m=vi.hoisted(()=>({documents:vi.fn(),audits:vi.fn(),transaction:vi.fn(),modules:vi.fn(),branch:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{$transaction:m.transaction,branch:{findFirst:m.branch}}}));
vi.mock("../modules",()=>({requireAccountModules:m.modules}));
import {runFinancialReportForActor} from "./service";
import {formatReport} from "./display";
import {DEFAULT_DISPLAY_PREFERENCES} from "../display-preferences";
import type {ProjectActor} from "../projects";
const actor={id:"actor",companyId:"company",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",isActive:true,accountAccessActive:true,branchAccessScope:"SELECTED_BRANCHES",branchIds:["branch"]} as ProjectActor;
const line={id:"line",itemName:"Panel",quantity:new Prisma.Decimal(5),baseQuantity:new Prisma.Decimal(5),lineTotal:new Prisma.Decimal(100)};
const order={id:"order",status:"POSTED",issueDate:new Date("2026-10-21"),documentNumber:"SO-1",partyName:"Customer",grandTotal:new Prisma.Decimal(100),lines:[line]};
const target={id:"sale",sourceSalesOrderId:"order",sourcePurchaseOrderId:null,lines:[{sourceOrderLineId:"line",quantity:new Prisma.Decimal(2),baseQuantity:new Prisma.Decimal(2)}]};
const raw={from:"2026-10-01",to:"2026-10-21"};
beforeEach(()=>{vi.clearAllMocks();m.transaction.mockImplementation(async fn=>fn({commercialDocument:{findMany:m.documents},accountOperationalAudit:{findMany:m.audits}}));m.documents.mockResolvedValueOnce([order]).mockResolvedValueOnce([target]);m.audits.mockResolvedValue([]);m.modules.mockResolvedValue(undefined)});
it("uses authorized date scope and explicit quantities without changing ledger or stock",async()=>{
 const report=await runFinancialReportForActor(actor,"order-items",raw);expect(report.rows).toEqual([["SO-1","Customer","OPEN","Panel","5.0000","2.0000","3.0000","100.00"]]);expect(report.rowLinks).toEqual(["/workspace/account/transactions/order"]);expect(report.nativeRowLinks).toEqual(report.rowLinks);expect(m.documents.mock.calls[0][0].where).toMatchObject({companyId:"company",branchId:{in:["branch"]},type:"SALES_ORDER",issueDate:{gte:new Date(raw.from),lte:new Date(raw.to)}});expect(m.modules).toHaveBeenCalledWith(actor,"SALES","SALES_ORDER");expect(formatReport(report,DEFAULT_DISPLAY_PREFERENCES).rows[0][7]).toBe("₹100.00");
});
it("filters current closed status without using monetary completion",async()=>{
 m.audits.mockResolvedValueOnce([{entityId:"order"}]).mockResolvedValueOnce([]);
 const report=await runFinancialReportForActor(actor,"order-transactions",{...raw,orderStatus:"CLOSED"});expect(report.rows[0][3]).toBe("CLOSED");expect(report.summary?.[1].value).toBe("100.00");
});
it("keeps historical unallocated fulfilment unresolved",async()=>{
 m.documents.mockReset().mockResolvedValueOnce([order]).mockResolvedValueOnce([{...target,lines:[{...target.lines[0],sourceOrderLineId:null}]}]);
 const report=await runFinancialReportForActor(actor,"order-items",{...raw,orderStatus:"UNRESOLVED"});expect(report.rows[0].slice(2,7)).toEqual(["UNRESOLVED","Panel","Unresolved","Unresolved","Unresolved"]);
});
it("ignores explicitly replaced sales but preserves original order commitment",async()=>{
 m.audits.mockResolvedValueOnce([]).mockResolvedValueOnce([{entityId:"sale"}]);const report=await runFinancialReportForActor(actor,"order-items",raw);expect(report.rows[0].slice(4,7)).toEqual(["5.0000","0.0000","5.0000"]);
});
it("rejects wrong party dimension, module-off and manager access before report data",async()=>{
 await expect(runFinancialReportForActor(actor,"order-items",{...raw,vendorId:"11111111-1111-4111-8111-111111111111"})).rejects.toThrow("REPORT_FILTER_NOT_SUPPORTED");
 m.modules.mockRejectedValueOnce(new Error("MODULE_DISABLED"));await expect(runFinancialReportForActor(actor,"order-items",raw)).rejects.toThrow("MODULE_DISABLED");
 await expect(runFinancialReportForActor({...actor,accountRole:"PROJECT_MANAGER"},"order-items",raw)).rejects.toThrow();expect(m.transaction).not.toHaveBeenCalled();
});
it("purchase orders use purchase lineage and module gates",async()=>{
 m.documents.mockReset().mockResolvedValueOnce([order]).mockResolvedValueOnce([{...target,sourceSalesOrderId:null,sourcePurchaseOrderId:"order"}]);await runFinancialReportForActor(actor,"order-transactions",{...raw,orderType:"PURCHASE_ORDER"});expect(m.modules).toHaveBeenCalledWith(actor,"PURCHASES","PURCHASE_ORDER");expect(m.documents.mock.calls[1][0].where.sourcePurchaseOrderId).toEqual({in:["order"]});
});

it("paginates over a thousand orders without truncation or rounding away cents",async()=>{
 const orders=Array.from({length:1001},(_,i)=>({...order,id:`order-${i}`,documentNumber:`SO-${i}`,grandTotal:new Prisma.Decimal("9999999999999999.99")}));let page=0;
 m.documents.mockReset().mockImplementation(async input=>input.where.type?orders.slice(page++*500,page*500):[]);
 const report=await runFinancialReportForActor(actor,"order-transactions",raw);expect(report.rows).toHaveLength(1001);expect(report.summary?.map(x=>x.value)).toEqual(["1001","10009999999999999989.99"]);expect(m.documents.mock.calls.filter(([input])=>input.where.type).map(([input])=>input.cursor)).toEqual([undefined,{id:"order-499"},{id:"order-999"}]);
});
