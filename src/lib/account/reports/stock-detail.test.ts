import {beforeEach, expect, it, vi} from "vitest";
import {Prisma, StockMovementType} from "@prisma/client";
const m=vi.hoisted(()=>({category:vi.fn(),products:vi.fn(),warehouses:vi.fn(),movements:vi.fn(),scope:vi.fn(),branch:vi.fn(),inventory:vi.fn()}));
vi.mock("../inventory",()=>({assertInventoryAvailable:m.inventory}));
const tx={accountCategory:{findFirst:m.category},accountProduct:{findMany:m.products},warehouse:{findMany:m.warehouses},stockMovement:{findMany:m.movements}};
vi.mock("@/lib/db",()=>({db:{$transaction:m.scope,branch:{findFirst:m.branch}}}));
import {runFinancialReportForActor} from "./service";
import {formatReport} from "./display";
import {DEFAULT_DISPLAY_PREFERENCES} from "../display-preferences";
import type {ProjectActor} from "../projects";
const branch="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
const actor={id:"actor",companyId:"company",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",isActive:true,accountAccessActive:true,branchAccessScope:"SELECTED_BRANCHES",branchIds:[branch]} as ProjectActor;
const input={from:"2026-10-01",to:"2026-10-18"};
const product=(id="item",unit="kg")=>({id,name:id,unit:{id:unit,name:unit,symbol:unit},category:{name:"Materials"}});
const movement=(movementType:StockMovementType,quantity:string,date="2026-10-18",productId="item",id="move")=>({id,productId,movementType,quantity:new Prisma.Decimal(quantity),movementDate:new Date(date)});
beforeEach(()=>{vi.clearAllMocks();m.category.mockResolvedValue({id:other,name:"Materials"});m.products.mockResolvedValue([product()]);m.warehouses.mockResolvedValue([{id:"warehouse"}]);m.movements.mockResolvedValue([]);m.branch.mockResolvedValue({id:branch});m.inventory.mockResolvedValue(undefined);m.scope.mockImplementation(async work=>work(tx))});
it("keeps opening, in, out and closing coherent for negative stock and returns",async()=>{
 m.movements.mockResolvedValue([movement("SALE","3","2026-09-30"),movement("PURCHASE","2"),movement("SALE","1"),movement("SALES_RETURN","0.2501")]);
 const report=await runFinancialReportForActor(actor,"stock-detail",input);
 expect(report.rows).toEqual([["item","Materials","kg","-3.0000","2.2501","1.0000","-1.7499"]]);
 expect(report.summary?.[0]).toMatchObject({value:"-1.7499 kg",money:false});
 expect(m.scope).toHaveBeenCalledExactlyOnceWith(expect.any(Function),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
});
it("uses existing movement directions for opening, purchases, returns, transfers and adjustments",async()=>{
 m.movements.mockResolvedValue(Object.values(StockMovementType).map(type=>movement(type,"1")));
 const report=await runFinancialReportForActor(actor,"stock-detail",input);expect(report.rows[0].slice(3)).toEqual(["0.0000","5.0000","4.0000","1.0000"]);
});
it("bounds metadata, warehouse and movement reads to company, branch and inclusive cutoff",async()=>{
 await runFinancialReportForActor(actor,"stock-detail",input);
 expect(m.products).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:"company",trackInventory:true}}));
 expect(m.warehouses).toHaveBeenCalledWith({where:{companyId:"company",isActive:true,branchId:{in:[branch]}},select:{id:true}});
 expect(m.movements).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:"company",warehouseId:{in:["warehouse"]},movementDate:{lte:new Date("2026-10-18T23:59:59.999Z")}}}));
});
it("retains exact quantities across paginated history and ignores unknown product identities",async()=>{
 const first=Array.from({length:1000},(_,index)=>movement("PURCHASE","1","2026-10-18","item",`page-${index}`));
 m.movements.mockResolvedValueOnce(first).mockResolvedValueOnce([movement("SALE","1"),movement("PURCHASE","999","2026-10-18","foreign")]);
 const report=await runFinancialReportForActor(actor,"stock-detail",input);expect(report.rows[0].slice(3)).toEqual(["0.0000","1000.0000","1.0000","999.0000"]);
 expect(m.movements.mock.calls[1][0]).toMatchObject({cursor:{id:"page-999"},skip:1,take:1000});
});
it("keeps mixed and unspecified units out of a fabricated combined quantity",async()=>{
 m.products.mockResolvedValue([product(),product("bolt","Nos")]);
 const report=await runFinancialReportForActor(actor,"stock-detail",input);expect(report.summary?.every(item=>item.value==="Mixed units")).toBe(true);
 m.products.mockResolvedValue([{...product("a"),unit:null},{...product("b"),unit:null}]);
 expect((await runFinancialReportForActor(actor,"stock-detail",input)).summary?.[0].value).toBe("Mixed units");
});
it("preserves all four quantity decimals in display and export, regardless of money settings",async()=>{
 m.movements.mockResolvedValue([movement("PURCHASE","1.2345")]);const result=await runFinancialReportForActor(actor,"stock-detail",input);
 for(const exporting of [false,true])expect(formatReport(result,{...DEFAULT_DISPLAY_PREFERENCES,baseCurrency:"USD",displayDecimalPlaces:0},exporting).rows[0].slice(3)).toEqual(["0.0000","1.2345","0.0000","1.2345"]);
});
it("denies branch, role, module/Items-disabled and unsupported filter inputs without movement reads",async()=>{
 for(const [user,filter]of [[{...actor,accountRole:"PROJECT_MANAGER"},input],[{...actor,accountRole:"DATA_ENTRY"},input],[actor,{...input,branchId:other}],[actor,{...input,projectId:other}]] as const)await expect(runFinancialReportForActor(user,"stock-detail",filter)).rejects.toThrow();
 m.inventory.mockRejectedValue(new Error("ITEMS_DISABLED"));await expect(runFinancialReportForActor(actor,"stock-detail",input)).rejects.toThrow("ITEMS_DISABLED");expect(m.movements).not.toHaveBeenCalled();expect(m.scope).not.toHaveBeenCalled();
});
it("returns an empty report without inventing an opening stock balance",async()=>{
 m.products.mockResolvedValue([]);const result=await runFinancialReportForActor(actor,"stock-detail",input);expect(result.rows).toEqual([]);expect(result.summary?.[0].value).toBe("—");
});

it("applies company-scoped category and active status together",async()=>{
 await runFinancialReportForActor(actor,"stock-detail",{...input,categoryId:other,itemStatus:"ACTIVE"});
 expect(m.category).toHaveBeenCalledWith({where:{companyId:"company",id:other},select:{id:true,name:true}});
 expect(m.products).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:"company",trackInventory:true,categoryId:other,isActive:true}}));
});
it("supports uncategorized inactive items without a category lookup",async()=>{
 const report=await runFinancialReportForActor(actor,"stock-detail",{...input,categoryId:"UNCATEGORIZED",itemStatus:"INACTIVE"});
 expect(m.category).not.toHaveBeenCalled();expect(m.products).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:"company",trackInventory:true,categoryId:null,isActive:false}}));expect(report.note).toContain("Uncategorized (no category)");
});
it("rejects foreign categories, invalid statuses and filters on unsupported reports",async()=>{
 m.category.mockResolvedValue(null);
 await expect(runFinancialReportForActor(actor,"stock-detail",{...input,categoryId:other})).rejects.toThrow();
 await expect(runFinancialReportForActor(actor,"stock-detail",{...input,itemStatus:"DELETED"})).rejects.toThrow();
 await expect(runFinancialReportForActor(actor,"stock-category",{...input,categoryId:other})).rejects.toThrow();
 expect(m.products).not.toHaveBeenCalled();expect(m.movements).not.toHaveBeenCalled();
});

it("bounds trimmed case-insensitive item search to authorized stock metadata",async()=>{
 await runFinancialReportForActor(actor,"stock-detail",{...input,itemSearch:"  Pipe  "});expect(m.products).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:"company",trackInventory:true,name:{contains:"Pipe",mode:"insensitive"}}}));
 await expect(runFinancialReportForActor(actor,"stock-detail",{...input,itemSearch:"x".repeat(241)})).rejects.toThrow();await expect(runFinancialReportForActor(actor,"bank-statement",{...input,itemSearch:"Pipe"})).rejects.toThrow("REPORT_FILTER_NOT_SUPPORTED");
});

it("treats database search wildcards as literal item-name characters",async()=>{
 await runFinancialReportForActor(actor,"stock-detail",{...input,itemSearch:"%_"});expect(m.products.mock.calls[0][0].where.name.contains).toBe("\\%\\_");
});
