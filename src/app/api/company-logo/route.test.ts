import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),company:vi.fn(),get:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({requireUser:mocks.user}));
vi.mock("@/lib/db",()=>({db:{company:{findUnique:mocks.company}}}));
vi.mock("@/lib/storage",()=>({privateStorage:()=>({get:mocks.get})}));
import{GET}from"./route";
describe("private company logo",()=>{beforeEach(()=>vi.clearAllMocks());it("serves only the authenticated tenant logo",async()=>{mocks.user.mockResolvedValue({companyId:"company-a"});mocks.company.mockResolvedValue({logoObjectKey:"Logo/company-a.webp"});mocks.get.mockResolvedValue(Buffer.from("webp"));const response=await GET();expect(mocks.company).toHaveBeenCalledWith({where:{id:"company-a"},select:{logoObjectKey:true}});expect(mocks.get).toHaveBeenCalledWith("Logo/company-a.webp");expect(response.status).toBe(200);expect(response.headers.get("content-type")).toBe("image/webp");expect(response.headers.get("cache-control")).toContain("private")});it("cannot select another tenant and safely returns 404 without a logo",async()=>{mocks.user.mockResolvedValue({companyId:"company-a"});mocks.company.mockResolvedValue(null);const response=await GET();expect(response.status).toBe(404);expect(mocks.get).not.toHaveBeenCalled()})});
