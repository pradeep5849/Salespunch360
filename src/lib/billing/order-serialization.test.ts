import {Prisma} from '@prisma/client';
import {beforeEach,describe,expect,it,vi} from 'vitest';

const events:string[]=[];
const mocks=vi.hoisted(()=>({permission:vi.fn(),transaction:vi.fn(),existing:vi.fn(),prices:vi.fn(),company:vi.fn(),raw:vi.fn(),orderCreate:vi.fn(),auditCreate:vi.fn(),entitlement:vi.fn()}));
vi.mock('@/lib/auth/authorization',()=>({requirePermissionForMutation:mocks.permission,requirePermission:vi.fn(),requireRole:vi.fn()}));
vi.mock('@/lib/billing/entitlement',()=>({effectiveEntitlement:mocks.entitlement}));
vi.mock('@/lib/billing/seat-reduction',()=>({applyDueSeatReductions:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{billingOrder:{findUnique:mocks.existing},billingPrice:{findMany:mocks.prices},user:{count:vi.fn()},$transaction:mocks.transaction}}));
import {createBillingOrder} from './service';

const request=(managerSeats:number)=>({billingPeriod:'MONTHLY',adminSeats:1,managerSeats,salesSeats:1,retainAdminUserIds:[],retainManagerUserIds:[],retainSalesUserIds:[],idempotencyKey:'order-key-123456789'});
const prices=['ADMIN','MANAGER','SALES'].map(role=>({role,period:'MONTHLY',currency:'INR',amount:new Prisma.Decimal(100)}));
function tx(){return{$queryRaw:mocks.raw,company:{findUnique:mocks.company},billingOrder:{create:mocks.orderCreate},billingAuditEvent:{create:mocks.auditCreate}}}

beforeEach(()=>{vi.clearAllMocks();events.length=0;mocks.permission.mockResolvedValue({id:'primary',companyId:'company'});mocks.existing.mockResolvedValue(null);mocks.prices.mockResolvedValue(prices);mocks.entitlement.mockResolvedValue({adminUsage:0,managerUsage:0,salesUsage:0,paidActive:false});mocks.raw.mockImplementation(async()=>{events.push('company-lock');return[]});mocks.company.mockImplementation(async()=>{events.push('company-reread');return{id:'company',teamStructure:'MANAGERS_AND_SALES'}});mocks.orderCreate.mockImplementation(async({data})=>{events.push('order-write');return{id:'order',...data}});mocks.auditCreate.mockImplementation(async()=>{events.push('audit-write');return{id:'audit'}});mocks.transaction.mockImplementation(work=>work(tx()))});

describe('billing order company serialization',()=>{
 it('locks and authoritatively rereads the company before policy validation and order/audit writes',async()=>{await createBillingOrder(request(1));expect(events).toEqual(['company-lock','company-reread','order-write','audit-write']);expect(mocks.raw).toHaveBeenCalledTimes(1)});
 it('rejects Manager seats for SALES_ONLY before order and audit writes',async()=>{mocks.company.mockImplementation(async()=>{events.push('company-reread');return{id:'company',teamStructure:'SALES_ONLY'}});await expect(createBillingOrder(request(1))).rejects.toThrow('MANAGERS_DISABLED');expect(events).toEqual(['company-lock','company-reread']);expect(mocks.orderCreate).not.toHaveBeenCalled();expect(mocks.auditCreate).not.toHaveBeenCalled()});
 it('allows zero Manager seats for SALES_ONLY',async()=>{mocks.company.mockImplementation(async()=>{events.push('company-reread');return{id:'company',teamStructure:'SALES_ONLY'}});await expect(createBillingOrder(request(0))).resolves.toBeTruthy();expect(events).toEqual(['company-lock','company-reread','order-write','audit-write'])});
});
