import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({role:vi.fn(),user:vi.fn(),issue:vi.fn(),verify:vi.fn(),limit:vi.fn(),origin:vi.fn(),revalidate:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));vi.mock("@/lib/auth/authorization",()=>({requireRole:mocks.role}));vi.mock("@/lib/db",()=>({db:{user:{findUnique:mocks.user}}}));vi.mock("@/lib/auth/email-verification",()=>({issueEmailVerification:mocks.issue,verifyEmailToken:mocks.verify}));vi.mock("@/lib/security/request",()=>({assertTrustedOrigin:mocks.origin,consumeRateLimit:mocks.limit}));
import{confirmVerification,resendVerificationEmail}from"./email-verification";
beforeEach(()=>{vi.clearAllMocks();mocks.role.mockResolvedValue({id:"admin",role:"COMPANY_ADMIN"});mocks.user.mockResolvedValue({email:"admin@example.com",emailVerifiedAt:null});mocks.limit.mockResolvedValue(true);mocks.issue.mockResolvedValue(undefined)});
describe("verification actions",()=>{
 it("rate limits authenticated resend without exposing account state",async()=>{mocks.limit.mockResolvedValue(false);const result=await resendVerificationEmail({});expect(result.status).toBe("success");expect(mocks.issue).not.toHaveBeenCalled();expect(mocks.origin).toHaveBeenCalled()});
 it("returns a safe retry message while preserving service errors",async()=>{mocks.issue.mockRejectedValue(new Error("secret SMTP response"));const result=await resendVerificationEmail({});expect(result).toEqual({status:"error",message:expect.not.stringContaining("SMTP response")})});
 it("consumes verification only through the trusted-origin confirmation action",async()=>{mocks.verify.mockResolvedValue(true);const form=new FormData();form.set("token","x".repeat(43));expect(await confirmVerification({},form)).toMatchObject({status:"success"});expect(mocks.origin).toHaveBeenCalled();expect(mocks.verify).toHaveBeenCalledWith("x".repeat(43))});
});
