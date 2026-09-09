import {beforeEach,describe,expect,it,vi} from 'vitest';
import {validateAuthoritativeRetention} from './retention';

const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const mocks={groupBy:vi.fn(),count:vi.fn()};
const tx={user:mocks} as never;
const snapshot=(role:'ADMIN'|'MANAGER'|'SALES',limit:number,retained:string[])=>({adminSeats:role==='ADMIN'?limit:5,managerSeats:role==='MANAGER'?limit:5,salesSeats:role==='SALES'?limit:5,retainAdminUserIds:role==='ADMIN'?retained:[],retainManagerUserIds:role==='MANAGER'?retained:[],retainSalesUserIds:role==='SALES'?retained:[]});

beforeEach(()=>{vi.clearAllMocks();mocks.count.mockResolvedValue(2)});

describe('authoritative retained-seat validation',()=>{
 it.each(['ADMIN','MANAGER','SALES'] as const)('validates current canonical %s users transactionally',async role=>{mocks.groupBy.mockResolvedValue([{salesRole:role,_count:3}]);await validateAuthoritativeRetention(tx,'company',snapshot(role,2,ids),{paidRenewal:true});expect(mocks.count).toHaveBeenCalledWith({where:{companyId:'company',salesRole:role,isActive:true,salesAccessActive:true,id:{in:ids}}})});
 it.each(['another company','wrong canonical role','Sales-suspended','globally inactive'])('rejects a retained user that is %s',async()=>{mocks.groupBy.mockResolvedValue([{salesRole:'SALES',_count:3}]);mocks.count.mockResolvedValue(1);await expect(validateAuthoritativeRetention(tx,'company',snapshot('SALES',2,ids),{paidRenewal:true})).rejects.toThrow('INVALID_SEAT_SELECTION')});
 it('rejects duplicate retained IDs',async()=>{mocks.groupBy.mockResolvedValue([{salesRole:'SALES',_count:3}]);await expect(validateAuthoritativeRetention(tx,'company',snapshot('SALES',2,[ids[0],ids[0]]),{paidRenewal:true})).rejects.toThrow('SEAT_SELECTION_REQUIRED');expect(mocks.count).not.toHaveBeenCalled()});
 it('allows a deterministic zero-seat reduction with active usage and an empty retained list',async()=>{mocks.groupBy.mockResolvedValue([{salesRole:'SALES',_count:3}]);await expect(validateAuthoritativeRetention(tx,'company',snapshot('SALES',0,[]),{paidRenewal:true})).resolves.toBeUndefined();expect(mocks.count).not.toHaveBeenCalled()});
 it('does not count Primary, suspended, inactive, or legacy-only users',async()=>{mocks.groupBy.mockResolvedValue([]);await validateAuthoritativeRetention(tx,'company',snapshot('SALES',0,[]),{paidRenewal:true});expect(mocks.groupBy).toHaveBeenCalledWith({by:['salesRole'],where:{companyId:'company',isActive:true,salesAccessActive:true,salesRole:{in:['ADMIN','MANAGER','SALES']}},_count:true})});
});
