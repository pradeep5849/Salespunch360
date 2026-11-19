import{beforeEach,describe,expect,it,vi}from"vitest";
const m=vi.hoisted(()=>({requireRole:vi.fn(),userFind:vi.fn(),taskFind:vi.fn()}));vi.mock("@/lib/auth/authorization",()=>({requirePermission:m.requireRole,requirePermissionForMutation:m.requireRole}));vi.mock("@/lib/db",()=>({db:{user:{findFirst:m.userFind},followUpTask:{findMany:m.taskFind}}}));vi.mock("@/lib/billing/entitlement",()=>({assertOperationalWrite:vi.fn()}));
import{listFollowUpTasks,taskScope,taskEmployeeWhere}from"./service";
const company="cccccccc-cccc-4ccc-8ccc-cccccccccccc",ids={admin:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",manager:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",self:"11111111-1111-4111-8111-111111111111",report:"22222222-2222-4222-8222-222222222222",other:"33333333-3333-4333-8333-333333333333"};
async function run(role:"COMPANY_ADMIN"|"MANAGER"|"SALES",actorId:string,employeeId:string,allowed:boolean){const salesRole=role==="COMPANY_ADMIN"?"PRIMARY_ADMIN":role;m.requireRole.mockResolvedValue({id:actorId,companyId:company,role,salesRole});m.userFind.mockResolvedValue(allowed?{id:employeeId}:null);m.taskFind.mockResolvedValue([]);expect(await listFollowUpTasks({employeeId})).toEqual([]);if(allowed)expect(m.taskFind).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({assignedUserId:employeeId})}));else expect(m.taskFind).not.toHaveBeenCalled()}
describe("follow-up employee filter scope",()=>{beforeEach(()=>vi.clearAllMocks());it("allows an Admin company employee",()=>run("COMPANY_ADMIN",ids.admin,ids.self,true));it("does not broaden an Admin cross-company filter",()=>run("COMPANY_ADMIN",ids.admin,ids.other,false));it("allows a Manager self filter",()=>run("MANAGER",ids.manager,ids.manager,true));it("allows a Manager direct-report filter",()=>run("MANAGER",ids.manager,ids.report,true));it("does not broaden an unrelated Sales filter",()=>run("MANAGER",ids.manager,ids.other,false));it("does not broaden another Manager filter",()=>run("MANAGER",ids.manager,ids.other,false));it("allows a Sales self filter",()=>run("SALES",ids.self,ids.self,true));it("does not broaden a Sales other-employee filter",()=>run("SALES",ids.self,ids.other,false))});

it("Telecallers see their own follow-up tasks while Admins supervise the company",()=>{
 const tele={id:ids.self,companyId:company,salesRole:"SALES" as const,designation:"Telecaller"};
 expect(taskScope(tele)).toEqual({companyId:company,assignedUserId:ids.self});
 expect(taskScope({...tele,salesRole:"PRIMARY_ADMIN"})).toEqual({companyId:company});
});
it("employee choices include active Telecallers without granting field access",()=>{
 const where=taskEmployeeWhere({id:ids.admin,companyId:company,salesRole:"PRIMARY_ADMIN"});
 expect(where.companyId).toBe(company);expect(where.isActive).toBe(true);
 expect(where.AND).toContainEqual({OR:[{salesAccessActive:true},{salesRole:"SALES",designation:{equals:"Telecaller",mode:"insensitive"}}]});
});
