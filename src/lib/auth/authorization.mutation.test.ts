import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),redirect:vi.fn()}));
vi.mock("./session",()=>({getAuthenticatedUser:mocks.user}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
import{requireRoleForMutation}from"./authorization";

beforeEach(()=>vi.clearAllMocks());
describe("server mutation authorization",()=>{
  it("throws a normal authentication error instead of redirecting for a missing session",async()=>{mocks.user.mockResolvedValue(null);await expect(requireRoleForMutation("SALES")).rejects.toMatchObject({name:"AuthenticationError",message:"AUTHENTICATION_REQUIRED"});expect(mocks.redirect).not.toHaveBeenCalled();});
  it("rejects a session with the wrong role",async()=>{mocks.user.mockResolvedValue({id:"admin",role:"SUPER_ADMIN",companyId:null});await expect(requireRoleForMutation("SALES")).rejects.toMatchObject({name:"AuthorizationError",message:"Not authorized"});});
});
