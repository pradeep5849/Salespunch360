import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),branch:vi.fn(),create:vi.fn(),customers:vi.fn(),find:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({AuthorizationError:class extends Error{},requirePermission:m.auth,requirePermissionForMutation:m.auth}));
vi.mock("@/lib/db",()=>({db:{branch:{findFirst:m.branch},customer:{findMany:m.customers,create:m.create},accountSettings:{findUnique:m.find},customFieldDefinition:{findMany:m.find}}}));
import {accountMasterOverview,createAccountCustomer,createAccountCustomerForBranch} from "./service";
const branchId="11111111-1111-4111-8111-111111111111";
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({companyId:"company",accountRole:"ACCOUNT_ADMIN",branchAccessScope:"SELECTED_BRANCHES",branchIds:[branchId]});m.find.mockResolvedValue([]);m.customers.mockResolvedValue([]);m.branch.mockResolvedValue({id:branchId})});
describe("A042-F01/F05 master permissions and branch scope",()=>{
 it("filters restricted customer reads by authorized branches",async()=>{await accountMasterOverview("customers");expect(m.customers).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:"company",isAccountCustomer:true,branchId:{in:[branchId]}}}))});
 it("chooses an authorized default branch instead of an unauthorized primary",async()=>{await createAccountCustomer({name:"Customer"});expect(m.branch).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:"company",isActive:true,id:{in:[branchId]}}}));expect(m.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({branchId})}))});
 it("rejects explicit unauthorized branch before creating a customer",async()=>{await expect(createAccountCustomerForBranch("other",{name:"Customer"})).rejects.toThrow();expect(m.branch).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled()});
 it("rejects an inactive or foreign-company branch",async()=>{m.branch.mockResolvedValue(null);await expect(createAccountCustomerForBranch(branchId,{name:"Customer"})).rejects.toThrow();expect(m.create).not.toHaveBeenCalled()});
 it("hides Add from project managers but keeps authorized master creation",async()=>{m.auth.mockResolvedValue({companyId:"company",accountRole:"PROJECT_MANAGER"});expect((await accountMasterOverview("customers")).canCreate).toBe(false);m.auth.mockResolvedValue({companyId:"company",accountRole:"ACCOUNTANT"});expect((await accountMasterOverview("customers")).canCreate).toBe(true)});
});
