import {beforeEach,describe,expect,it,vi} from "vitest";
import {AuthorizationError} from "@/lib/auth/authorization";
const m=vi.hoisted(()=>({auth:vi.fn(),permit:vi.fn(),write:vi.fn(),confirm:vi.fn()}));
vi.mock("@/lib/mobile/auth",()=>({authenticateMobileToken:m.auth}));
vi.mock("@/lib/mobile/account-transactions",()=>({permit:m.permit}));
vi.mock("@/lib/billing/entitlement",()=>({assertOperationalWrite:m.write}));
vi.mock("@/lib/account/commercial",()=>({confirmSalesOrderForActor:m.confirm}));
import {POST} from "./route";
const id="11111111-1111-4111-8111-111111111111",actor={id:"actor",companyId:"company"};
const request=()=>new Request(`https://app.invalid/api/orders/${id}/confirm`,{method:"POST",headers:{authorization:"Bearer test","content-type":"application/json"},body:JSON.stringify({documentId:"forged",companyId:"foreign",sourceQuotationRevisionId:"forged"})});
const context={params:Promise.resolve({id})};
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({id:"user"});m.permit.mockReturnValue(actor);m.confirm.mockResolvedValue({id,status:"POSTED"});});
describe("Sales Order explicit confirmation boundary",()=>{
 it("uses authenticated actor and route identity only, checks entitlement and returns no-store",async()=>{
  const response=await POST(request(),context);
  expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({id,status:"POSTED"});
  expect(m.auth).toHaveBeenCalledExactlyOnceWith("Bearer test");
  expect(m.permit).toHaveBeenCalledExactlyOnceWith({id:"user"},"ACCOUNT_SALES_ENTRY");
  expect(m.write).toHaveBeenCalledExactlyOnceWith("company");
  expect(m.confirm).toHaveBeenCalledExactlyOnceWith(actor,{documentId:id});
 });
 it("rejects missing authentication before writes",async()=>{m.auth.mockRejectedValue(new Error("MOBILE_UNAUTHORIZED"));expect((await POST(request(),context)).status).toBe(401);expect(m.confirm).not.toHaveBeenCalled();expect(m.write).not.toHaveBeenCalled();});
 it("rejects role denial before entitlement or domain mutation",async()=>{m.permit.mockImplementation(()=>{throw new AuthorizationError()});expect((await POST(request(),context)).status).toBe(403);expect(m.write).not.toHaveBeenCalled();expect(m.confirm).not.toHaveBeenCalled();});
 it("does not mutate when operational writes are denied",async()=>{m.write.mockRejectedValue(new AuthorizationError());expect((await POST(request(),context)).status).toBe(403);expect(m.confirm).not.toHaveBeenCalled();});
 it.each([["NOT_FOUND",404],["DOCUMENT_NOT_FINALIZABLE",409]] as const)("maps %s safely to HTTP %s",async(code,status)=>{m.confirm.mockRejectedValue(new Error(code));const response=await POST(request(),context);expect(response.status).toBe(status);expect(await response.json()).toMatchObject({error:code});});
 it.each(["QUOTATION_ALREADY_CONVERTED","QUOTATION_APPROVAL_REQUIRED","QUOTATION_REVISION_CHANGED"])("returns a controlled conflict for %s",async code=>{m.confirm.mockRejectedValue(new Error(code));const response=await POST(request(),context);expect(response.status).toBe(409);expect(await response.json()).toMatchObject({error:code});});
 it.each([new AuthorizationError(),new Error("MODULE_DISABLED:SALES_ORDER")])("preserves domain authorization/module denial",async error=>{m.confirm.mockRejectedValue(error);expect((await POST(request(),context)).status).toBe(403);});
});
