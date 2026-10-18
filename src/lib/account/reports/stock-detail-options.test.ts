import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({categories:vi.fn(),inventory:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{accountCategory:{findMany:m.categories}}}));
vi.mock("../inventory",()=>({assertInventoryAvailable:m.inventory}));
import {stockDetailCategoriesForActor} from "./stock-detail-options";
import type {ProjectActor} from "../projects";
const actor={id:"actor",companyId:"company",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",isActive:true,accountAccessActive:true} as ProjectActor;
beforeEach(()=>{vi.clearAllMocks();m.categories.mockResolvedValue([{id:"category",name:"Materials"}]);m.inventory.mockResolvedValue(undefined)});
it("lists only company categories with an explicit unassigned choice",async()=>{
 expect(await stockDetailCategoriesForActor(actor)).toEqual([{id:"UNCATEGORIZED",name:"Uncategorized (no category)"},{id:"category",name:"Materials"}]);
 expect(m.categories).toHaveBeenCalledWith({where:{companyId:"company"},select:{id:true,name:true},orderBy:[{name:"asc"},{id:"asc"}]});
});
it("does not read categories for unauthorized roles or disabled inventory",async()=>{
 await expect(stockDetailCategoriesForActor({...actor,accountRole:"PROJECT_MANAGER"})).rejects.toThrow();
 await expect(stockDetailCategoriesForActor({...actor,companyId:null} as unknown as ProjectActor)).rejects.toThrow();
 m.inventory.mockRejectedValue(new Error("ITEMS_DISABLED"));await expect(stockDetailCategoriesForActor(actor)).rejects.toThrow("ITEMS_DISABLED");expect(m.categories).not.toHaveBeenCalled();
});
it("propagates database failures rather than silently hiding categories",async()=>{
 m.categories.mockRejectedValue(new Error("database unavailable"));await expect(stockDetailCategoriesForActor(actor)).rejects.toThrow("database unavailable");
});
