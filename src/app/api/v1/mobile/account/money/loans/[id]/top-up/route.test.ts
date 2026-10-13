import {beforeEach,describe,expect,it,vi} from "vitest";
import {AuthorizationError} from "@/lib/auth/authorization";
const m=vi.hoisted(()=>({auth:vi.fn(),edit:vi.fn()}));vi.mock("@/lib/mobile/auth",()=>({authenticateMobileToken:m.auth}));vi.mock("@/lib/mobile/account-money",()=>({mobileTopUpLoan:m.edit}));
import {POST} from "./route";
describe("authenticated loan top-up endpoint",()=>{
 beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({id:"actor"});m.edit.mockResolvedValue({id:"loan",version:1});});
 const request=()=>new Request("https://app.invalid/loans/loan",{method:"POST",headers:{authorization:"Bearer test","content-type":"application/json"},body:JSON.stringify({requestKey:"key",expectedVersion:0,displayName:"Edited"})});
 it("authenticates and forwards explicit identity/version without caching",async()=>{const response=await POST(request(),{params:Promise.resolve({id:"loan"})});expect(response.status).toBe(200);expect(m.auth).toHaveBeenCalledWith("Bearer test");expect(m.edit).toHaveBeenCalledWith({id:"actor"},"loan",{requestKey:"key",expectedVersion:0,displayName:"Edited"});expect(response.headers.get("cache-control")).toBe("no-store");});
 it("keeps unauthorized and stale edits controlled",async()=>{m.auth.mockRejectedValueOnce(new Error("MOBILE_UNAUTHORIZED"));expect((await POST(request(),{params:Promise.resolve({id:"loan"})})).status).toBe(401);expect(m.edit).not.toHaveBeenCalled();m.edit.mockRejectedValueOnce(new AuthorizationError());expect((await POST(request(),{params:Promise.resolve({id:"loan"})})).status).toBe(403);m.edit.mockRejectedValueOnce(new Error("LOAN_CHANGED"));expect((await POST(request(),{params:Promise.resolve({id:"loan"})})).status).toBe(409);});
});
