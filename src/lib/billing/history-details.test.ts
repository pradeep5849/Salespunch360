import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({markers:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{billingAuditEvent:{findMany:m.markers}}}));
import {orderTelecallerTargets} from './history-details';
beforeEach(()=>vi.clearAllMocks());
it('reads only requested company orders and does not replace an invalid latest target with an older value',async()=>{m.markers.mockResolvedValue([{entityId:'first',metadata:{telecallerSeats:3}},{entityId:'bad',metadata:{telecallerSeats:'invalid'}},{entityId:'bad',metadata:{telecallerSeats:8}}]);const targets=await orderTelecallerTargets('company',['first','bad']);expect(targets.get('first')).toBe(3);expect(targets.has('bad')).toBe(false);expect(m.markers).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:'company',entityId:{in:['first','bad']},type:'ORDER_CREATED',reason:'UNIFIED_TELECALLER_TARGET'}}))});
it('avoids an unbounded audit query for an empty page',async()=>{expect((await orderTelecallerTargets('company',[])).size).toBe(0);expect(m.markers).not.toHaveBeenCalled()});
