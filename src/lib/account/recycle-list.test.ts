import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({findMany:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{accountRecycleRecord:{findMany:m.findMany}}}));
import { recycleListForCompany } from "./recycle-list";
beforeEach(()=>{vi.clearAllMocks();m.findMany.mockResolvedValue([])});
it("keeps company and archived-only scope, stable ordering and bounded paging",async()=>{
 m.findMany.mockResolvedValue(Array.from({length:51},(_,id)=>({id})));
 const result=await recycleListForCompany("company",{page:"3",q:" Name "});
 expect(result.items).toHaveLength(50);expect(result.hasMore).toBe(true);
 expect(m.findMany).toHaveBeenCalledWith({where:{companyId:"company",restoredAt:null,purgedAt:null,displayName:{contains:"Name",mode:"insensitive"}},orderBy:[{archivedAt:"desc"},{id:"desc"}],skip:100,take:51});
});
it("has no next page when exactly 50 records remain",async()=>{m.findMany.mockResolvedValue(Array.from({length:50},(_,id)=>({id})));expect((await recycleListForCompany("company",{})).hasMore).toBe(false)});
it.each([0,-1,1.5,"bad",100001])("rejects invalid page %s before reading",async page=>{await expect(recycleListForCompany("company",{page})).rejects.toThrow();expect(m.findMany).not.toHaveBeenCalled()});
