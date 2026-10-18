import {beforeEach, expect, it, vi} from "vitest";
import {Prisma} from "@prisma/client";
const m=vi.hoisted(()=>({products:vi.fn(),snapshot:vi.fn(),branch:vi.fn(),modules:vi.fn()}));
vi.mock("../inventory",()=>({listInventoryProductsForActor:m.products,inventorySnapshotForActor:m.snapshot,itemProfitability:vi.fn()}));
vi.mock("../modules",()=>({requireAccountModules:m.modules}));
vi.mock("@/lib/db",()=>({db:{branch:{findFirst:m.branch}}}));
import {runFinancialReportForActor} from "./service";
import {formatReport} from "./display";
import {reportExportRows} from "./export-data";
import {DEFAULT_DISPLAY_PREFERENCES} from "../display-preferences";
import type {ProjectActor} from "../projects";
const branch="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
const actor={id:"actor",companyId:"company",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",isActive:true,accountAccessActive:true,branchAccessScope:"SELECTED_BRANCHES",branchIds:[branch]} as ProjectActor;
const D=(value:string)=>new Prisma.Decimal(value);
const product=(id:string,unit="kg",category="Materials")=>({id,name:`Item ${id}`,trackInventory:true,isActive:true,category:{id:category,name:category},unit:{id:unit,name:unit,symbol:unit}});
beforeEach(()=>{vi.clearAllMocks();m.products.mockResolvedValue([]);m.snapshot.mockResolvedValue([]);m.modules.mockResolvedValue(undefined);m.branch.mockResolvedValue({id:branch})});
it("uses scoped stock services with inactive items and the inclusive To cutoff",async()=>{
 await runFinancialReportForActor(actor,"stock-category",{from:"2026-10-01",to:"2026-10-18"});
 expect(m.modules).toHaveBeenCalledWith(actor,"INVENTORY");expect(m.products).toHaveBeenCalledWith(actor,{includeInactive:true});
 expect(m.snapshot).toHaveBeenCalledWith(actor,new Date("2026-10-18T23:59:59.999Z"));
 await runFinancialReportForActor({...actor,branchAccessScope:"ALL_BRANCHES"},"stock-category",{branchId:branch,to:"2026-10-18"});
 expect(m.snapshot).toHaveBeenLastCalledWith(expect.objectContaining({companyId:"company",branchAccessScope:"SELECTED_BRANCHES",branchIds:[branch]}),new Date("2026-10-18T23:59:59.999Z"));
});
it("groups same-unit stock across items and warehouses while retaining other units",async()=>{
 m.products.mockResolvedValue([product("steel"),{...product("pipe"),isActive:false},product("bolts","Nos")]);
 m.snapshot.mockResolvedValue([{productId:"steel",quantity:D("1.2501"),stockValue:D("12.34")},{productId:"steel",quantity:D("2"),stockValue:D("20")},{productId:"pipe",quantity:D("-1"),stockValue:D("-10")},{productId:"bolts",quantity:D("7"),stockValue:D("3")}]);
 const report=await runFinancialReportForActor(actor,"stock-category",{to:"2026-10-18"});
 expect(report.rows).toEqual([["Materials","kg","2.2501","22.34"],["Materials","Nos","7.0000","3.00"]]);
 expect(report.totals).toEqual(["Total stock value","","","25.34"]);expect(report.note).toContain("start date does not limit stock history");
});
it("keeps unspecified units separate and excludes untracked items",async()=>{
 m.products.mockResolvedValue([{...product("a"),category:null,unit:null},{...product("b"),category:null,unit:null},{...product("service"),trackInventory:false}]);
 const report=await runFinancialReportForActor(actor,"stock-category",{});
 expect(report.rows).toEqual([["Uncategorized","Unspecified (Item a)","0.0000","0.00"],["Uncategorized","Unspecified (Item b)","0.0000","0.00"]]);
});
it("preserves large aggregate cents independently of quantity formatting",async()=>{
 m.products.mockResolvedValue([product("a"),product("b")]);m.snapshot.mockResolvedValue([{productId:"a",quantity:D("1"),stockValue:D("9999999999999999.99")},{productId:"b",quantity:D("1"),stockValue:D("0.02")}]);
 const report=await runFinancialReportForActor(actor,"stock-category",{});expect(report.rows[0][3]).toBe("10000000000000000.01");
});
it("returns a zero-value empty report without fabricating a quantity total",async()=>{
 const report=await runFinancialReportForActor(actor,"stock-category",{});expect(report.rows).toEqual([]);expect(report.totals).toEqual(["Total stock value","","","0.00"]);
});
it("formats only valuation as money and preserves units/quantities in exports",async()=>{
 m.products.mockResolvedValue([product("a")]);m.snapshot.mockResolvedValue([{productId:"a",quantity:D("1.2345"),stockValue:D("12.34")}]);
 const report=await runFinancialReportForActor(actor,"stock-category",{}),formatted=formatReport(report,{...DEFAULT_DISPLAY_PREFERENCES,baseCurrency:"USD",displayDecimalPlaces:3},true);
 expect(formatted.columns).toEqual(["Item Category","Unit","Stock quantity","Value (USD)"]);expect(formatted.rows[0]).toEqual(["Materials","kg","1.2345","12.340"]);
 expect(reportExportRows(formatted,"Branch A")).toContainEqual(["Total stock value","","","12.340"]);
});
it("denies role, branch and unsupported Project filters before stock reads",async()=>{
 for(const [user,filter]of [[{...actor,accountRole:"PROJECT_MANAGER"},{}],[{...actor,accountRole:"DATA_ENTRY"},{}],[actor,{branchId:other}],[actor,{projectId:other}]] as const)await expect(runFinancialReportForActor(user,"stock-category",filter)).rejects.toThrow();
 expect(m.products).not.toHaveBeenCalled();expect(m.snapshot).not.toHaveBeenCalled();
});
it("denies Inventory OFF before stock reads",async()=>{
 m.modules.mockRejectedValue(new Error("MODULE_DISABLED:INVENTORY"));await expect(runFinancialReportForActor(actor,"stock-category",{})).rejects.toThrow("MODULE_DISABLED:INVENTORY");expect(m.products).not.toHaveBeenCalled();expect(m.snapshot).not.toHaveBeenCalled();
});
