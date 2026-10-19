import { beforeEach,expect,it,vi } from "vitest";
import { Prisma } from "@prisma/client";
const m=vi.hoisted(()=>({transaction:vi.fn(),document:vi.fn(),settings:vi.fn(),modules:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{$transaction:m.transaction}}));
vi.mock("./modules",()=>({requireAccountModules:m.modules}));
import { salePriceProposalsForActor,confirmSalePriceForActor,retailRateFromInvoice } from "./sale-price-updates";
import type { ProjectActor } from "./projects";
const id="00000000-0000-4000-8000-000000000001",actor={id,companyId:id,isActive:true,role:"COMPANY_ADMIN",accountRole:"ACCOUNT_ADMIN",accountAccessActive:true,branchAccessScope:"SELECTED_BRANCHES",branchIds:[id]} as ProjectActor;
beforeEach(()=>{vi.resetAllMocks();m.modules.mockResolvedValue(undefined);m.transaction.mockImplementation(fn=>fn({commercialDocument:{findFirst:m.document},accountSettings:{findUnique:m.settings}}));m.document.mockResolvedValue(null);m.settings.mockResolvedValue({itemSettings:{updateSalePrice:false}});});
it("excludes GST and cess from tax-inclusive retail rates and retains exact minor units",()=>{const d=(s:string)=>new Prisma.Decimal(s);expect(retailRateFromInvoice(d("120"),"INCLUSIVE",d("18"),d("2")).toString()).toBe("100");expect(retailRateFromInvoice(d("90"),"EXCLUSIVE",d("18"),d("2")).toString()).toBe("90");expect(retailRateFromInvoice(d("999999999999.99"),"EXCLUSIVE",d("0"),d("0")).toString()).toBe("999999999999.99");});
it("requires explicit consent and stock permission before opening a mutation transaction",async()=>{await expect(confirmSalePriceForActor(actor,{documentId:id,lineId:id,expectedUpdatedAt:new Date().toISOString(),requestKey:id,confirmed:false})).rejects.toThrow();await expect(confirmSalePriceForActor({...actor,accountRole:"DATA_ENTRY"},{confirmed:true})).rejects.toThrow();expect(m.transaction).not.toHaveBeenCalled();});
it("scopes invoice lookup to company and currently assigned branches",async()=>{await expect(salePriceProposalsForActor(actor,id)).rejects.toThrow();expect(m.document).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id,companyId:id,branchId:{in:[id]},type:"SALES_INVOICE"})}));});
it("returns no proposals while OFF and rejects module denial before document reads",async()=>{m.document.mockResolvedValue({status:"POSTED",journalEntry:{status:"POSTED"},lines:[]});expect(await salePriceProposalsForActor(actor,id)).toEqual([]);m.document.mockClear();m.modules.mockRejectedValue(new Error("MODULE_DISABLED:INVENTORY"));await expect(salePriceProposalsForActor(actor,id)).rejects.toThrow("MODULE_DISABLED:INVENTORY");expect(m.document).not.toHaveBeenCalled();});
it("converts retained selected-unit rates into primary prices before consent and rounds once",()=>{
 const d=(value:string)=>new Prisma.Decimal(value),snapshot={version:1,selection:"SECONDARY",primaryUnitId:id,secondaryUnitId:"00000000-0000-4000-8000-000000000002",secondaryUnitsPerBase:"0.1",unitName:"Box",unitSymbol:"box"};
 expect(retailRateFromInvoice(d("210"),"EXCLUSIVE",d("0"),d("0"),snapshot).toString()).toBe("21");
 expect(retailRateFromInvoice(d("236"),"INCLUSIVE",d("18"),d("0"),snapshot).toString()).toBe("20");
 expect(retailRateFromInvoice(d("23.65"),"INCLUSIVE",d("18"),d("0"),snapshot).toFixed(2)).toBe("2.00");
 expect(retailRateFromInvoice(d("20"),"EXCLUSIVE",d("0"),d("0"),{...snapshot,selection:"PRIMARY"}).toString()).toBe("20");
});
it("rejects corrupted retained unit metadata and unrepresentable primary prices",()=>{
 const d=(value:string)=>new Prisma.Decimal(value),snapshot={version:1,selection:"SECONDARY",primaryUnitId:id,secondaryUnitId:"00000000-0000-4000-8000-000000000002",secondaryUnitsPerBase:"10",unitName:"Piece",unitSymbol:"pc"};
 expect(()=>retailRateFromInvoice(d("9999999999999999.99"),"EXCLUSIVE",d("0"),d("0"),snapshot)).toThrow("UNIT_CONVERSION_OVERFLOW");
 expect(()=>retailRateFromInvoice(d("10"),"EXCLUSIVE",d("0"),d("0"),{...snapshot,secondaryUnitsPerBase:"0"})).toThrow("INVALID_UNIT_SNAPSHOT");
});
