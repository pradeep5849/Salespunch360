import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({webAuth:vi.fn(),guard:vi.fn(),mobileAuth:vi.fn(),create:vi.fn(),mobileCreate:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{}}));
vi.mock("@/lib/auth/authorization",async original=>({...await original<object>(),requirePermissionForMutation:mocks.webAuth}));
vi.mock("@/lib/security/request",()=>({mutationGuard:mocks.guard}));
vi.mock("@/lib/mobile/auth",()=>({authenticateMobileToken:mocks.mobileAuth}));
vi.mock("@/lib/quotations/service",()=>({createQuotationForActor:mocks.create}));
vi.mock("@/lib/mobile/account-quotations",()=>({mobileCreateQuotation:mocks.mobileCreate}));
import {POST as web} from "@/app/api/account/quotations/with-attachments/route";
import {POST as mobile} from "@/app/api/v1/mobile/account/quotations/with-attachments/route";
const request=()=>{const body=new FormData();body.set("document",JSON.stringify({branchId:"branch"}));body.set("creationRequestKey","key");body.set("attachments",new File(["%PDF-1.7"],"plan.pdf",{type:"application/pdf"}));return new Request("http://example.test/",{method:"POST",body})};
describe("atomic first-Save attachment routes",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.webAuth.mockResolvedValue({id:"staff"});mocks.mobileAuth.mockResolvedValue({id:"native"});mocks.create.mockResolvedValue({id:"saved"});mocks.mobileCreate.mockResolvedValue({id:"saved"})});
 it("requires Web mutation authorization and origin guard before accepting the body",async()=>{
  mocks.guard.mockRejectedValue(new Error("UNTRUSTED_ORIGIN"));const input=request();expect((await web(input)).status).toBe(403);expect(input.bodyUsed).toBe(false);expect(mocks.create).not.toHaveBeenCalled();expect(mocks.webAuth).toHaveBeenCalledWith("ACCOUNT_QUOTATION_EDIT");
 });
 it("passes Web creation and selected files to one domain operation",async()=>{const response=await web(request());expect(response.status).toBe(201);expect(response.headers.get("cache-control")).toContain("no-store");expect(mocks.create).toHaveBeenCalledWith({id:"staff"},{branchId:"branch",creationRequestKey:"key"},[expect.any(File)])});
 it("rejects unauthenticated native upload before parsing or invoking the adapter",async()=>{mocks.mobileAuth.mockRejectedValue(new Error("MOBILE_UNAUTHORIZED"));const input=request();expect((await mobile(input)).status).toBe(401);expect(input.bodyUsed).toBe(false);expect(mocks.mobileCreate).not.toHaveBeenCalled()});
 it("uses the native permission and entitlement adapter for creation",async()=>{expect((await mobile(request())).status).toBe(201);expect(mocks.mobileCreate).toHaveBeenCalledWith({id:"native"},{branchId:"branch",creationRequestKey:"key"},[expect.any(File)])});
 it("preserves native permission denial without exposing details",async()=>{mocks.mobileCreate.mockRejectedValue(new Error("MOBILE_FORBIDDEN"));expect((await mobile(request())).status).toBe(403)});
 it("returns conflict for changed creation intent and redacts storage failures",async()=>{mocks.create.mockRejectedValueOnce(new Error("IDEMPOTENCY_KEY_REUSED"));expect((await web(request())).status).toBe(409);mocks.create.mockRejectedValueOnce(new Error("private-storage-secret"));const failure=await web(request());expect(failure.status).toBe(503);expect(await failure.text()).not.toContain("private-storage-secret")});
});
