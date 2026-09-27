import {beforeEach,describe,expect,it,vi} from 'vitest';
const events:string[]=[];
const mocks=vi.hoisted(()=>({transaction:vi.fn(),raw:vi.fn(),subscription:vi.fn(),order:vi.fn(),users:vi.fn(),suspend:vi.fn(),updateOrder:vi.fn(),audit:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{companySubscription:{findMany:mocks.subscription},$transaction:mocks.transaction}}));
vi.mock('@/lib/auth/lifecycle',()=>({suspendSalesAccessInTransaction:mocks.suspend}));
import {applyDueSeatReductions} from './seat-reduction';
beforeEach(()=>{
 vi.clearAllMocks();events.length=0;
 mocks.raw.mockImplementation((strings:TemplateStringsArray)=>{events.push(strings.join(' ').includes('companies')?'company-lock':'order-lock');return []});
 mocks.subscription.mockImplementation(()=>{events.push('subscription-read');return [{id:'subscription',sourceOrderId:'order',sourceOrder:{provider:'RAZORPAY',seatReductionAppliedAt:null}}]});
 mocks.order.mockImplementation(()=>{events.push('order-read');return {adminSeats:0,managerSeats:1,salesSeats:1,retainAdminUserIds:[],retainManagerUserIds:['manager'],retainSalesUserIds:['sales'],seatReductionAppliedAt:null}});
 mocks.users.mockImplementation(()=>{events.push('users-read');return [{id:'primary',salesRole:'PRIMARY_ADMIN'},{id:'admin',salesRole:'ADMIN'},{id:'manager',salesRole:'MANAGER'},{id:'sales',salesRole:'SALES'}]});
 mocks.suspend.mockImplementation((_tx,id)=>{events.push(`user:${id}`)});
 mocks.transaction.mockImplementation(work=>work({$queryRaw:mocks.raw,companySubscription:{findMany:mocks.subscription},billingOrder:{findFirst:mocks.order,update:mocks.updateOrder},user:{findMany:mocks.users},billingAuditEvent:{create:mocks.audit}}));
});
describe('canonical three-role seat reduction',()=>{
 it('preflights without a lock, then locks company and order before reducing canonical ADMIN',async()=>{await applyDueSeatReductions('company');expect(events).toEqual(['subscription-read','company-lock','subscription-read','order-lock','order-read','users-read','user:admin']);expect(mocks.suspend).toHaveBeenCalledWith(expect.anything(),'admin');expect(mocks.suspend).not.toHaveBeenCalledWith(expect.anything(),'primary')});
 it('preserves identity and Account fields by using Sales-only lifecycle suspension',async()=>{await applyDueSeatReductions('company');expect(mocks.suspend).toHaveBeenCalled();expect(mocks.updateOrder).toHaveBeenCalledWith({where:{id:'order'},data:{seatReductionAppliedAt:expect.any(Date)}});expect(mocks.audit).toHaveBeenCalledWith({data:expect.objectContaining({metadata:expect.objectContaining({adminSeats:0,suspendedSalesUserIds:['admin']})})})});
 it('rechecks the effective subscription only after company locking',async()=>{await applyDueSeatReductions('company');const reads=events.map((value,index)=>value==='subscription-read'?index:-1).filter(index=>index>=0);expect(reads).toHaveLength(2);expect(reads[0]).toBeLessThan(events.indexOf('company-lock'));expect(reads[1]).toBeGreaterThan(events.indexOf('company-lock'));expect(reads[1]).toBeLessThan(events.indexOf('order-lock'))});
});
