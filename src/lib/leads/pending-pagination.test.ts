import {it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({find:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{customerVisit:{findMany:m.find}}}));
vi.mock('@/lib/branches/operational-scope',()=>({operationalBranchContext:async()=>({branchId:{in:['branch']}}),resolveOperationalWriteBranch:vi.fn()}));
import {listPendingVisitsPageForActor} from './service';
it('loads a bounded next page under existing company, own-user and branch predicates',async()=>{m.find.mockResolvedValue(Array.from({length:51},(_,i)=>({id:String(i)})));const result=await listPendingVisitsPageForActor({id:'sales',companyId:'company',salesRole:'SALES',name:'Sales',email:'s@example.test',managerType:null,designation:null},undefined,'Acme',{page:5,pageSize:50});expect(result.items).toHaveLength(50);expect(result.hasMore).toBe(true);expect(m.find).toHaveBeenCalledWith(expect.objectContaining({skip:200,take:51,orderBy:[{checkedInAt:'desc'},{id:'desc'}],where:expect.objectContaining({AND:expect.arrayContaining([{branchId:{in:['branch']}}])})}));const where=JSON.stringify(m.find.mock.calls[0][0].where);expect(where).toContain('company');expect(where).toContain('sales');expect(where).toContain('Acme')});
