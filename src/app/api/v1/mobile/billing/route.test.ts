import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),cancel:vi.fn(),quote:vi.fn(),manual:vi.fn(),notice:vi.fn()}));
vi.mock('@/lib/mobile/auth',()=>({authenticateMobileSalesToken:m.auth}));
vi.mock('@/lib/mobile/billing',()=>({mobileBillingContext:vi.fn(),mobileBillingQuote:m.quote,mobileManualOrder:m.manual,mobileCancelPendingOrder:m.cancel}));
vi.mock('@/lib/billing/manual-payment-email',()=>({notifyManualPaymentOrderCreated:m.notice}));
import {POST} from './route';
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({id:'owner',companyId:'company',salesRole:'PRIMARY_ADMIN'});m.cancel.mockResolvedValue({ok:true})});
it('routes confirmed cancellation without creating or quoting an order or sending a creation notice',async()=>{
 const body={action:'CANCEL_PENDING_ORDER',orderId:'00000000-0000-4000-8000-000000000001',confirmed:true};
 const response=await POST(new Request('https://example.invalid/api/v1/mobile/billing',{method:'POST',headers:{authorization:'Bearer fixture-token','content-type':'application/json'},body:JSON.stringify(body)}));
 expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true});expect(m.cancel).toHaveBeenCalledWith(expect.objectContaining({id:'owner',companyId:'company'}),body);expect(m.manual).not.toHaveBeenCalled();expect(m.quote).not.toHaveBeenCalled();expect(m.notice).not.toHaveBeenCalled();
});
