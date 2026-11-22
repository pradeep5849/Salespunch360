import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({find:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{customer:{findMany:m.find},user:{findMany:async()=>[]},branch:{findMany:async()=>[]}}}));
vi.mock('@/lib/branches/operational-scope',()=>({operationalBranchContext:async()=>({branchIds:['allowed-branch']})}));
import {mobileCustomerAdminContext} from './customers';
const actor={id:'admin',companyId:'company',salesRole:'PRIMARY_ADMIN'} as Parameters<typeof mobileCustomerAdminContext>[0];
beforeEach(()=>{vi.clearAllMocks();m.find.mockResolvedValue(Array.from({length:51},(_,i)=>({id:String(i)})))});
it('pages only the authorized unassigned queue with a stable order and sentinel',async()=>{const result=await mobileCustomerAdminContext(actor,{page:'2',q:' Prospect '});expect(result.customers).toHaveLength(50);expect(result).toMatchObject({page:2,hasMore:true,q:'Prospect'});expect(m.find).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:'company',branchId:{in:['allowed-branch']},assignedUserId:null,name:{contains:'Prospect',mode:'insensitive'}},orderBy:[{name:'asc'},{id:'asc'}],skip:50,take:51}))});
it('does not expose admin queue reads to ordinary Sales',async()=>{await expect(mobileCustomerAdminContext({...actor,salesRole:'SALES'})).rejects.toThrow();expect(m.find).not.toHaveBeenCalled()});
