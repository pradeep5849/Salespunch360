import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>{
 const tx={
  user:{findFirst:vi.fn()},
  customer:{create:vi.fn()},
  lead:{findFirst:vi.fn(),create:vi.fn()},
  leadActivity:{create:vi.fn()}
 };
 return{role:vi.fn(),tx,transaction:vi.fn(async(cb:(client:typeof tx)=>unknown)=>cb(tx))};
});
vi.mock("@/lib/auth/authorization",()=>({requirePermissionForMutation:mocks.role,requirePermission:mocks.role}));
vi.mock("@/lib/db",()=>({db:{$transaction:mocks.transaction}}));
import{createCustomer}from"./service";

describe("Customer creation boundary",()=>{
 beforeEach(()=>{
  vi.clearAllMocks();
  mocks.role.mockResolvedValue({id:"admin",role:"COMPANY_ADMIN",salesRole:"PRIMARY_ADMIN",companyId:"company"});
  mocks.tx.customer.create.mockResolvedValue({id:"customer",name:"Acme",phone:"+12025550110"});
  mocks.tx.lead.findFirst.mockResolvedValue(null);
  mocks.tx.lead.create.mockResolvedValue({id:"lead"});
 });
 it("creates an unassigned Customer without creating a Lead",async()=>{
  await createCustomer({name:"Acme",phone:"+12025550110"});
  expect(mocks.tx.customer.create).toHaveBeenCalledWith({data:{name:"Acme",phone:"+12025550110",companyId:"company",branchId:"00000000-0000-0000-0000-000000000001",assignedUserId:undefined}});
  expect(mocks.tx.user.findFirst).not.toHaveBeenCalled();
  expect(mocks.tx.lead.create).not.toHaveBeenCalled();
  expect(mocks.tx.leadActivity.create).not.toHaveBeenCalled();
 });
 it("creates a Lead immediately when the Admin assigns the new Customer",async()=>{
  mocks.tx.user.findFirst.mockResolvedValue({id:"sales"});
  await createCustomer({name:"Acme",phone:"+12025550110",assignedUserId:"11111111-1111-4111-8111-111111111111"});
  expect(mocks.tx.user.findFirst).toHaveBeenCalledWith({where:{id:"11111111-1111-4111-8111-111111111111",companyId:"company",isActive:true,salesAccessActive:true,OR:[{salesRole:"SALES"},{salesRole:"MANAGER",managerType:"FIELD_MANAGER"}]},select:{id:true}});
  expect(mocks.tx.customer.create).toHaveBeenCalledWith({data:{name:"Acme",phone:"+12025550110",companyId:"company",branchId:"00000000-0000-0000-0000-000000000001",assignedUserId:"sales"}});
  expect(mocks.tx.lead.create).toHaveBeenCalledWith({data:{companyId:"company",branchId:"00000000-0000-0000-0000-000000000001",customerId:"customer",assignedUserId:"sales",createdByUserId:"admin",title:"Acme",contactName:"Acme",phone:"+12025550110",source:"MANUAL",stage:"NEW"}});
  expect(mocks.tx.leadActivity.create).toHaveBeenCalled();
 });
 it.each(["MANAGER","SALES"])("rejects %s Customer creation",async role=>{
  mocks.role.mockRejectedValue(new Error("Not authorized"));
  await expect(createCustomer({name:"Acme",phone:"+12025550110"})).rejects.toThrow("Not authorized");
  expect(mocks.transaction).not.toHaveBeenCalled();
  void role;
 });
});
