import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({customers:vi.fn(),history:vi.fn(),checkIn:vi.fn(),checkout:vi.fn()}));
vi.mock('@/lib/customers/service',()=>({searchCustomersForCompany:mocks.customers}));vi.mock('@/lib/visits/service',()=>({getOwnVisitHistoryForUser:mocks.history,checkInForUser:mocks.checkIn,checkoutForUser:mocks.checkout}));
import {mobileCheckIn,mobileCheckout,mobileFieldContext} from './field';import type {MobilePrincipal} from './auth';
const user=(role:MobilePrincipal['role'],companyId='company-a'):MobilePrincipal=>({id:'user-a',name:'Field',email:'field@example.com',role,companyId});
beforeEach(()=>{vi.clearAllMocks();mocks.checkIn.mockResolvedValue({visit:{id:'visit-a',checkedInAt:new Date()},isFirstVisit:true,isRepeatVisit:false});mocks.customers.mockResolvedValue([{id:'customer-a',companyId:'company-a',name:'Acme',contactPerson:null,phone:null,email:null,address:null,latitude:null,longitude:null,createdAt:new Date(),updatedAt:new Date()}]);mocks.history.mockResolvedValue([])});
describe('mobile field boundary',()=>{
 it('scopes customers and visit history to authenticated identity',async()=>{await mobileFieldContext(user('SALES'));expect(mocks.customers).toHaveBeenCalledWith('company-a','');expect(mocks.history).toHaveBeenCalledWith(expect.objectContaining({id:'user-a',companyId:'company-a'}))});
 it('allows Manager and Sales but rejects Company Admin field operations',async()=>{await mobileFieldContext(user('MANAGER'));await expect(mobileFieldContext(user('COMPANY_ADMIN'))).rejects.toMatchObject({code:'FORBIDDEN',status:403})});
 it('passes server principal to authoritative check-in and checkout services',async()=>{const location={latitude:1,longitude:2,accuracyMeters:5};await mobileCheckIn(user('SALES'),{customerId:'c',location});await mobileCheckout(user('SALES'),{visitId:'v',location,sentiment:'NEUTRAL'});expect(mocks.checkIn).toHaveBeenCalledWith(expect.objectContaining({companyId:'company-a',id:'user-a'}),expect.anything());expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({companyId:'company-a',id:'user-a'}),expect.anything())});
 it('does not expose tenant metadata from customer rows',async()=>{const result=await mobileFieldContext(user('SALES'));expect(JSON.stringify(result)).not.toMatch(/companyId|password|session/i)});
});
