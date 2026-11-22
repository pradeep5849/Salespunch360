import {beforeEach,it,expect,vi} from 'vitest';
import {Prisma} from '@prisma/client';
const m=vi.hoisted(()=>({company:vi.fn(),prices:vi.fn()}));
vi.mock('@/lib/auth/authorization',()=>({AuthorizationError:class extends Error{},requireUser:async()=>({id:'account-admin',companyId:'company',role:'ACCOUNT_USER',accountRole:'ACCOUNT_ADMIN',accountAccessActive:true,salesAccessActive:false,salesRole:null}),requireUserForMutation:vi.fn(),requireGlobalSuperAdmin:vi.fn(),requireGlobalSuperAdminForMutation:vi.fn()}));
vi.mock('@/lib/auth/permissions',()=>({canUsePermission:()=>false}));
vi.mock('@/lib/db',()=>({db:{company:{findUnique:m.company},billingPrice:{findMany:m.prices},billingOrder:{findMany:async()=>[]},user:{findMany:async()=>[]},companySubscription:{findMany:async()=>[]}}}));
import {billingDashboard} from './service';
beforeEach(()=>{vi.clearAllMocks();m.company.mockResolvedValue({id:'company',productEdition:'SALESPUNCH360_ACCOUNT',subscriptionStatus:'INACTIVE',trialEndsAt:null});m.prices.mockResolvedValue([{role:'ACCOUNT_PACKAGE',period:'SIX_MONTH',amount:new Prisma.Decimal('900.50')},{role:'ACCOUNT_PACKAGE',period:'YEARLY',amount:new Prisma.Decimal('1500.25')}])});
it('uses configured Account prices even when Sales billing is unavailable',async()=>{const result=await billingDashboard();expect(result.hasSales).toBe(false);expect(result.account.sixMonthUnitPrice).toBe(900.50);expect(result.account.yearlyUnitPrice).toBe(1500.25);expect(m.prices).toHaveBeenCalledOnce()});
