import {it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({transaction:vi.fn(),upsert:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{user:{findFirst:async()=>({id:'sales'})},salesTarget:{upsert:m.upsert},$transaction:m.transaction}}));
vi.mock('@/lib/billing/entitlement',()=>({assertOperationalWrite:vi.fn()}));
vi.mock('@/lib/branches/operational-scope',()=>({operationalBranchContext:vi.fn(),resolveOperationalWriteBranch:async()=> 'branch'}));
import {saveMonthlyTargetsForActor} from './service';
it.each([-1,1.5,Infinity,NaN])('rejects invalid monthly count %s before financial target writes',async value=>{await expect(saveMonthlyTargetsForActor({id:'admin',name:'Admin',companyId:'company',salesRole:'PRIMARY_ADMIN'},{assignedUserId:'sales',leadTarget:value,wonTarget:0})).rejects.toThrow('INVALID_TARGET');expect(m.upsert).not.toHaveBeenCalled();expect(m.transaction).not.toHaveBeenCalled()});
