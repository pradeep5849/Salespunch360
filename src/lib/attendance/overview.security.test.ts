import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({role:vi.fn(),users:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({requirePermission:mocks.role}));vi.mock("@/lib/db",()=>({db:{user:{findMany:mocks.users}}}));
import{getAttendanceOverview}from"./service";
beforeEach(()=>{vi.clearAllMocks();mocks.users.mockResolvedValue([])});
describe("team attendance scope",()=>{
 it("scopes a Manager to assigned Sales in the same tenant",async()=>{mocks.role.mockResolvedValue({id:"manager-a",role:"MANAGER",salesRole:"MANAGER",companyId:"company-a"});await getAttendanceOverview();expect(mocks.users).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:"company-a",salesRole:"SALES",managerId:"manager-a",salesAccessActive:true,isActive:true}}))});
 it("keeps Company Admin visibility company-wide for employee roles",async()=>{mocks.role.mockResolvedValue({id:"admin",role:"COMPANY_ADMIN",salesRole:"PRIMARY_ADMIN",companyId:"company-a"});await getAttendanceOverview();expect(mocks.users).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:"company-a",salesRole:{in:["MANAGER","SALES"]},salesAccessActive:true,isActive:true}}))});
});
