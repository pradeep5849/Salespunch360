import {beforeEach,expect,it,vi} from "vitest";
import {Prisma} from "@prisma/client";
import type {ProjectActor} from "@/lib/account/projects";
const mocks=vi.hoisted(()=>({settings:vi.fn(),warehouses:vi.fn(),group:vi.fn(),transaction:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{$transaction:mocks.transaction}}));
import {quotationStockOptionsForActor} from "./stock-options";
const actor={companyId:"company",accountRole:"ACCOUNT_ADMIN",role:"ACCOUNT_USER",isActive:true,accountAccessActive:true,branchAccessScope:"SELECTED_BRANCHES",branchIds:["one","two"]} as ProjectActor;
beforeEach(()=>{vi.clearAllMocks();mocks.settings.mockResolvedValue({itemSettings:{enabled:true,stockMaintenance:true}});mocks.warehouses.mockResolvedValue([{id:"w1",branchId:"one"},{id:"w2",branchId:"one"},{id:"w3",branchId:"two"}]);mocks.group.mockResolvedValue([{productId:"item",warehouseId:"w1",movementType:"OPENING",_sum:{quantity:new Prisma.Decimal("10.1234")}},{productId:"item",warehouseId:"w2",movementType:"PURCHASE",_sum:{quantity:new Prisma.Decimal("5")}},{productId:"item",warehouseId:"w2",movementType:"SALE",_sum:{quantity:new Prisma.Decimal("2.0001")}},{productId:"item",warehouseId:"w3",movementType:"OPENING",_sum:{quantity:new Prisma.Decimal("7")}}]);mocks.transaction.mockImplementation(async fn=>fn({accountSettings:{findUnique:mocks.settings},warehouse:{findMany:mocks.warehouses},stockMovement:{groupBy:mocks.group}}))});
it("sums signed quantities by branch while preserving primary-unit precision",async()=>expect(await quotationStockOptionsForActor(actor,["item"])).toEqual({positions:[{productId:"item",branchId:"one",quantity:"13.1233"},{productId:"item",branchId:"two",quantity:"7.0000"}]}));
it("scopes quantity-only grouped SQL to company, permitted warehouses/products and cutoff",async()=>{
 const date=new Date("2026-10-17");await quotationStockOptionsForActor(actor,["item"],date);
 expect(mocks.warehouses).toHaveBeenCalledWith({where:{companyId:"company",isActive:true,branchId:{in:["one","two"]}},select:{id:true,branchId:true}});
 expect(mocks.group).toHaveBeenCalledWith({by:["productId","warehouseId","movementType"],where:{companyId:"company",productId:{in:["item"]},warehouseId:{in:["w1","w2","w3"]},movementDate:{lte:date}},_sum:{quantity:true}});
 expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function),{isolationLevel:"RepeatableRead"});
});
it("omits stock when items or stock maintenance are disabled",async()=>{
 for(const policy of [{enabled:false},{stockMaintenance:false}]){mocks.settings.mockResolvedValue({itemSettings:policy});expect(await quotationStockOptionsForActor(actor,["item"])).toBeNull()}
 expect(mocks.warehouses).not.toHaveBeenCalled();expect(mocks.group).not.toHaveBeenCalled();
});
it("never reads stock for a Project Manager or absent company",async()=>{
 expect(await quotationStockOptionsForActor({...actor,accountRole:"PROJECT_MANAGER"},["item"])).toBeNull();expect(await quotationStockOptionsForActor({...actor,companyId:""},["item"])).toBeNull();expect(await quotationStockOptionsForActor({...actor,accountRole:"DATA_ENTRY"},["item"])).toBeNull();expect(mocks.transaction).not.toHaveBeenCalled();
});
it("does not manufacture quantities or query movements for no eligible products/warehouses",async()=>{
 expect(await quotationStockOptionsForActor(actor,[])).toEqual({positions:[]});expect(mocks.group).not.toHaveBeenCalled();mocks.warehouses.mockResolvedValue([]);expect(await quotationStockOptionsForActor(actor,["item"])).toEqual({positions:[]});expect(mocks.group).not.toHaveBeenCalled();
});
it("ignores any grouped result outside eligible warehouse/product identities and exposes no costs",async()=>{
 mocks.group.mockResolvedValue([{productId:"item",warehouseId:"foreign",movementType:"OPENING",_sum:{quantity:new Prisma.Decimal(100)}},{productId:"other",warehouseId:"w1",movementType:"OPENING",_sum:{quantity:new Prisma.Decimal(100)}}]);expect(await quotationStockOptionsForActor(actor,["item"])).toEqual({positions:[]});
});
it("uses all recorded movements for the default current-stock view, matching inventory snapshot semantics",async()=>{
 await quotationStockOptionsForActor(actor,["item"]);expect(mocks.group).toHaveBeenCalledWith(expect.objectContaining({where:expect.not.objectContaining({movementDate:expect.anything()})}));
});
