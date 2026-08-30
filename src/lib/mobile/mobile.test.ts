import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({company:vi.fn(),attendance:vi.fn(),entitlement:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{company:{findUnique:mocks.company},attendance:{findFirst:mocks.attendance}}}));
vi.mock('@/lib/billing/entitlement',()=>({effectiveEntitlement:mocks.entitlement}));
import {isMobileRole,mobileBootstrap,type MobilePrincipal} from './auth';
import {mobileLoginSchema,mobilePointSchema} from './validation';
const user:MobilePrincipal={id:'user-1',name:'Ada',email:'ada@example.com',role:'COMPANY_ADMIN',companyId:'company-1'};
beforeEach(()=>{vi.clearAllMocks();mocks.company.mockResolvedValue({name:'Acme',teamStructure:'MANAGERS_AND_SALES',attendanceEnabled:true,gpsTrackingEnabled:true});mocks.entitlement.mockResolvedValue({state:'TRIAL',operationalWritesAllowed:true,managerLimit:1,salesLimit:5,managerUsage:1,salesUsage:3})});
describe('mobile boundary',()=>{
 it('allows only tenant mobile roles',()=>{expect(isMobileRole('COMPANY_ADMIN')).toBe(true);expect(isMobileRole('MANAGER')).toBe(true);expect(isMobileRole('SALES')).toBe(true);expect(isMobileRole('SUPER_ADMIN')).toBe(false)});
 it('rejects role and tenant mass assignment',()=>expect(mobileLoginSchema.safeParse({identifier:'user@example.com',password:'long-enough',role:'COMPANY_ADMIN',companyId:'x'}).success).toBe(false));
 it('requires an idempotent UUID for queued points',()=>{expect(mobilePointSchema.safeParse({clientPointId:crypto.randomUUID(),latitude:20,longitude:70,accuracyMeters:10,capturedAt:new Date().toISOString()}).success).toBe(true);expect(mobilePointSchema.safeParse({latitude:20,longitude:70,capturedAt:new Date().toISOString()}).success).toBe(false)});
 it('exposes authoritative team structure and entitlement seats',async()=>{const result=await mobileBootstrap(user);expect(result.teamStructure).toBe('MANAGERS_AND_SALES');expect(result.entitlement).toEqual({state:'TRIAL',operationalWritesAllowed:true,managerLimit:1,salesLimit:5,managerUsage:1,salesUsage:3});expect(mocks.entitlement).toHaveBeenCalledWith('company-1')});
 it('exposes sales-only structure without calculating limits at the mobile boundary',async()=>{mocks.company.mockResolvedValue({...await mocks.company(),teamStructure:'SALES_ONLY'});mocks.entitlement.mockResolvedValue({state:'TRIAL',operationalWritesAllowed:true,managerLimit:0,salesLimit:5,managerUsage:0,salesUsage:2});const result=await mobileBootstrap(user);expect(result.teamStructure).toBe('SALES_ONLY');expect(result.entitlement.managerLimit).toBe(0);expect(result.entitlement.salesLimit).toBe(5)});
});
