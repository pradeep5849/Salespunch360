import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({can:vi.fn(),find:vi.fn()}));
vi.mock('./auth',()=>({mobileCan:mocks.can}));
vi.mock('@/lib/db',()=>({db:{company:{findUnique:mocks.find}}}));
import {mobileReadOnlyCompanyDetails} from './company-details';
import type {MobilePrincipal} from './auth';
const actor={id:'member',companyId:'tenant'} as MobilePrincipal;
beforeEach(()=>{vi.clearAllMocks();mocks.can.mockReturnValue(true)});
it('uses the authenticated company and returns only authoritative public business fields',async()=>{
 mocks.find.mockResolvedValue({name:'Business',primaryContactName:null,contactEmail:'business@example.invalid',enabledModules:['LEADS'],id:'private-id',slug:'private-slug',logoObjectKey:'private-object',gpsTrackingEnabled:true,travelRatePerKm:99,subscriptionStatus:'ACTIVE'});
 const result=await mobileReadOnlyCompanyDetails(actor);
 expect(result.company).toMatchObject({name:'Business',primaryContactName:null,contactEmail:'business@example.invalid',enabledModules:['LEADS']});
 for(const key of ['id','slug','logoObjectKey','gpsTrackingEnabled','travelRatePerKm','subscriptionStatus'])expect(result.company).not.toHaveProperty(key);
 expect(mocks.can).toHaveBeenCalledWith(actor,'COMPANY_VIEW');
 expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({where:{id:'tenant'},select:expect.objectContaining({name:true,primaryPhone:true,gstin:true,pan:true})}));
});
it('rejects denied roles before reading company data',async()=>{mocks.can.mockReturnValue(false);await expect(mobileReadOnlyCompanyDetails(actor)).rejects.toThrow('MOBILE_FORBIDDEN');expect(mocks.find).not.toHaveBeenCalled()});
it('returns a missing-company error without fallback to another tenant',async()=>{mocks.find.mockResolvedValue(null);await expect(mobileReadOnlyCompanyDetails(actor)).rejects.toThrow('NOT_FOUND');expect(mocks.find).toHaveBeenCalledTimes(1)});
