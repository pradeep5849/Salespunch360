import {describe,it,expect} from 'vitest';
import {pendingOrderMatches} from './pending-order-intent';
const intent={billingPeriod:'YEARLY',adminSeats:1,managerSeats:0,salesSeats:2,accountPackages:1,telecallerSeats:3,retainSalesUserIds:['b','a']};
describe('pending order intent',()=>{
 it('reuses only identical targets, independent of retained-user ordering',()=>expect(pendingOrderMatches({...intent,retainSalesUserIds:['a','b']},intent,3)).toBe(true));
 for(const change of [{billingPeriod:'SIX_MONTH'},{salesSeats:4},{accountPackages:2},{retainSalesUserIds:['a']},{adminSeats:2}])it(`rejects changed ${Object.keys(change)[0]}`,()=>expect(pendingOrderMatches({...intent,...change},intent,3)).toBe(false));
 it('rejects a different Telecaller target',()=>expect(pendingOrderMatches(intent,intent,2)).toBe(false));
});
