import {beforeEach,expect,it,vi} from "vitest";
import {AuthorizationError} from "@/lib/auth/authorization";
const m=vi.hoisted(()=>({auth:vi.fn(),read:vi.fn(),write:vi.fn()}));
vi.mock("@/lib/mobile/auth",()=>({authenticateMobileToken:m.auth}));
vi.mock("@/lib/mobile/account-money",()=>({mobileAssetFundingOptions:m.read,mobileAssetFundingMutation:m.write}));
import {GET,POST} from "./route";
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({id:"actor"});m.read.mockResolvedValue({summary:[]});m.write.mockResolvedValue({id:"allocation"})});
const request=()=>new Request("https://app.invalid/api?branchId=branch",{method:"POST",headers:{authorization:"Bearer test","content-type":"application/json"},body:JSON.stringify({operation:"ALLOCATE",payload:{requestKey:"retry"}})});
it("forwards authenticated scope/search and excludes sensitive responses from caches",async()=>{
 const response=await GET(new Request("https://app.invalid/api?branchId=branch&q=owner",{headers:{authorization:"Bearer test"}}));
 expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");expect(m.read).toHaveBeenCalledWith({id:"actor"},{branchId:"branch",q:"owner"});
});
it("forwards immutable mutation identity",async()=>{expect((await POST(request())).status).toBe(201);expect(m.write).toHaveBeenCalledWith({id:"actor"},{operation:"ALLOCATE",payload:{requestKey:"retry"}})});
it("denies unauthenticated access before reading or mutating",async()=>{m.auth.mockRejectedValue(new Error("MOBILE_UNAUTHORIZED"));expect((await POST(request())).status).toBe(401);expect((await GET(new Request("https://app.invalid"))).status).toBe(401);expect(m.read).not.toHaveBeenCalled();expect(m.write).not.toHaveBeenCalled()});
it("returns controlled scope/module denial and retry conflict",async()=>{m.read.mockRejectedValue(new AuthorizationError());expect((await GET(new Request("https://app.invalid"))).status).toBe(403);m.write.mockRejectedValueOnce(new Error("MODULE_DISABLED:ASSETS"));expect((await POST(request())).status).toBe(403);m.write.mockRejectedValueOnce(new Error("IDEMPOTENCY_CONFLICT"));expect((await POST(request())).status).toBe(409)});
it("rejects malformed JSON without a write",async()=>{expect((await POST(new Request("https://app.invalid",{method:"POST",body:"{"}))).status).toBe(400);expect(m.write).not.toHaveBeenCalled()});
