import {beforeEach,it,expect,vi} from "vitest";
import {Prisma} from "@prisma/client";
const m=vi.hoisted(()=>({products:vi.fn(),snapshot:vi.fn(),inventory:vi.fn(),category:vi.fn(),branch:vi.fn()}));
vi.mock("../inventory",()=>({assertInventoryAvailable:m.inventory,listInventoryProductsForActor:m.products,inventorySnapshotForActor:m.snapshot}));
vi.mock("@/lib/db",()=>({db:{accountCategory:{findFirst:m.category},branch:{findFirst:m.branch}}}));
import {runFinancialReportForActor} from "./service";
import {formatReport} from "./display";
import {DEFAULT_DISPLAY_PREFERENCES} from "../display-preferences";
import type {ProjectActor} from "../projects";
const branch="11111111-1111-4111-8111-111111111111",category="22222222-2222-4222-8222-222222222222";
const actor={id:"actor",companyId:"company",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",isActive:true,accountAccessActive:true,branchAccessScope:"SELECTED_BRANCHES",branchIds:[branch]} as ProjectActor;
const D=Prisma.Decimal,input={to:"2026-10-18"};
beforeEach(()=>{vi.clearAllMocks();m.inventory.mockResolvedValue(undefined);m.branch.mockResolvedValue({id:branch});m.category.mockResolvedValue({name:"Materials"});m.products.mockResolvedValue([{id:"a",name:"Pipe",categoryId:category,category:{name:"Materials"},unit:{symbol:"kg"},isActive:false,trackInventory:true,lowStockThreshold:new D(1)},{id:"b",name:"Bolt",categoryId:null,category:null,unit:{symbol:"Nos"},isActive:true,trackInventory:true,lowStockThreshold:new D(2)}]);m.snapshot.mockResolvedValue([{productId:"a",quantity:new D("-1.2345"),stockValue:new D("-12.34")},{productId:"b",quantity:new D(2),stockValue:new D(10)}])});
it("reuses scoped movement valuation and separates primary quantities",async()=>{
 const r=await runFinancialReportForActor(actor,"stock-summary",input);expect(r.rows).toEqual([["Pipe","Materials","kg","-1.2345","-12.34"],["Bolt","Uncategorized","Nos","2.0000","10.00"]]);expect(r.summary?.map(x=>x.value)).toEqual(["2","2","-2.34"]);expect(m.snapshot).toHaveBeenCalledWith(actor,new Date("2026-10-18T23:59:59.999Z"));expect(m.products).toHaveBeenCalledWith(actor,{includeInactive:true});
});
it("uses <= threshold,including negative and zero-stock items,for low-stock report",async()=>{
 m.snapshot.mockResolvedValue([]);const r=await runFinancialReportForActor(actor,"low-stock-summary",input);expect(r.rows).toHaveLength(2);expect(r.summary?.[0].value).toBe("2");m.snapshot.mockResolvedValue([{productId:"a",quantity:new D(2),stockValue:new D(20)}]);expect((await runFinancialReportForActor(actor,"low-stock-summary",input)).rows.map(x=>x[0])).toEqual(["Bolt"]);
});
it("combines company category/current status and explicit branch scope",async()=>{
 const r=await runFinancialReportForActor(actor,"stock-summary",{...input,branchId:branch,categoryId:category,itemStatus:"INACTIVE",stockLevel:"NEGATIVE"});expect(r.rows).toHaveLength(1);expect(m.category).toHaveBeenCalledWith({where:{companyId:"company",id:category},select:{name:true}});expect(m.snapshot.mock.calls[0][0]).toMatchObject({branchAccessScope:"SELECTED_BRANCHES",branchIds:[branch]});
});
it("keeps uncategorized and available filters precise",async()=>{
 expect((await runFinancialReportForActor(actor,"stock-summary",{...input,categoryId:"UNCATEGORIZED",itemStatus:"ACTIVE"})).rows.map(x=>x[0])).toEqual(["Bolt"]);expect(m.category).not.toHaveBeenCalled();expect((await runFinancialReportForActor(actor,"stock-summary",{...input,stockLevel:"AVAILABLE"})).rows).toEqual([]);
});
it("rejects unavailable inventory,foreign category,role and unsupported scope",async()=>{
 await expect(runFinancialReportForActor({...actor,accountRole:"PROJECT_MANAGER"},"stock-summary",input)).rejects.toThrow();await expect(runFinancialReportForActor(actor,"low-stock-summary",{...input,stockLevel:"AVAILABLE"})).rejects.toThrow();await expect(runFinancialReportForActor(actor,"stock-summary",{...input,stockLevel:"UNKNOWN"})).rejects.toThrow();m.inventory.mockRejectedValueOnce(new Error("ITEMS_DISABLED"));await expect(runFinancialReportForActor(actor,"stock-summary",input)).rejects.toThrow("ITEMS_DISABLED");m.category.mockResolvedValue(null);await expect(runFinancialReportForActor(actor,"stock-summary",{...input,categoryId:category})).rejects.toThrow();expect(m.snapshot).not.toHaveBeenCalled();
});
it("retains quantity decimals while values follow company money formatting",async()=>{
 const r=await runFinancialReportForActor(actor,"stock-summary",input);const formatted=formatReport(r,{...DEFAULT_DISPLAY_PREFERENCES,baseCurrency:"USD",displayDecimalPlaces:0});expect(formatted.rows[0][3]).toBe("-1.2345");expect(formatted.rows[0][4]).toContain("$");expect(formatReport(r,DEFAULT_DISPLAY_PREFERENCES,true).rows[0][4]).toBe("-12.34");expect(formatReport(r,{...DEFAULT_DISPLAY_PREFERENCES,displayDecimalPlaces:0},true).rows[0].slice(3)).toEqual(["-1.2345","-12"]);
});
