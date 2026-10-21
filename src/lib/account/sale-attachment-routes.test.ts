import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({webAuth:vi.fn(),readAuth:vi.fn(),guard:vi.fn(),mobileAuth:vi.fn(),permit:vi.fn(),entitlement:vi.fn(),save:vi.fn(),download:vi.fn(),list:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{}}));
vi.mock("@/lib/auth/authorization",async original=>({...await original<object>(),requirePermissionForMutation:m.webAuth,requirePermission:m.readAuth}));
vi.mock("@/lib/security/request",()=>({mutationGuard:m.guard}));
vi.mock("@/lib/mobile/auth",()=>({authenticateMobileToken:m.mobileAuth}));
vi.mock("@/lib/mobile/account-transactions",()=>({permit:m.permit}));
vi.mock("@/lib/billing/entitlement",()=>({assertOperationalWrite:m.entitlement}));
vi.mock("@/lib/account/sale-submit",()=>({submitSaleForActor:m.save}));
vi.mock("@/lib/account/sale-attachments",async original=>({...await original<object>(),downloadSaleAttachmentForActor:m.download,listSaleAttachmentsForActor:m.list}));
import {POST as web} from "@/app/api/account/sales/with-attachments/route";
import {POST as mobile} from "@/app/api/v1/mobile/account/sales/with-attachments/route";
import {GET as webDownload} from "@/app/api/account/sale-attachments/[id]/route";
import {GET as mobileDownload} from "@/app/api/v1/mobile/account/sale-attachments/[id]/route";
import {GET as mobileList} from "@/app/api/v1/mobile/account/sales/[id]/attachments/route";
const request=()=>{const body=new FormData();body.set("document",JSON.stringify({type:"SALES_INVOICE",idempotencyKey:"save-key"}));body.set("payment",JSON.stringify({receivedAmount:"90"}));body.append("attachments",new File(["%PDF-1.7"],"plan.pdf",{type:"application/pdf"}));return new Request("http://example.test/",{method:"POST",body})};
const context={params:Promise.resolve({id:"route-owned-id"})};
describe("Sale file authenticated routes",()=>{
 beforeEach(()=>{vi.resetAllMocks();m.webAuth.mockResolvedValue({id:"web",companyId:"company"});m.readAuth.mockResolvedValue({id:"web-reader",companyId:"company"});m.mobileAuth.mockResolvedValue({id:"principal"});m.permit.mockReturnValue({id:"native",companyId:"company"});m.save.mockResolvedValue({id:"saved",documentNumber:"INV-1",status:"POSTED"});m.download.mockResolvedValue({data:Buffer.from("%PDF-1.7"),name:"plan.pdf",mimeType:"application/pdf"});m.list.mockResolvedValue([{id:"file",displayName:"plan.pdf"}])});
 it("requires Web mutation authorization and origin/rate guard before parsing",async()=>{
  m.guard.mockRejectedValue(new Error("UNTRUSTED_ORIGIN"));const r=request();expect((await web(r)).status).toBe(403);expect(r.bodyUsed).toBe(false);expect(m.save).not.toHaveBeenCalled();expect(m.webAuth).toHaveBeenCalledWith("ACCOUNT_JOURNAL_POST");
 });
 it("passes Web document/payment/files to one atomic Save operation",async()=>{
  const response=await web(request());expect(response.status).toBe(201);expect(await response.json()).toEqual({ok:true,id:"saved",documentNumber:"INV-1"});
  expect(m.save).toHaveBeenCalledWith({id:"web",companyId:"company"},{type:"SALES_INVOICE",idempotencyKey:"save-key"},{receivedAmount:"90"},"sale-save-receipt",[expect.any(File)]);
 });
 it("rejects an authenticated actor without a company before accepting file bytes",async()=>{
  m.webAuth.mockResolvedValue({id:"staff",companyId:null});const r=request();expect((await web(r)).status).toBe(403);expect(r.bodyUsed).toBe(false);expect(m.save).not.toHaveBeenCalled();
 });
 it("rejects an unauthenticated native request before parsing",async()=>{
  m.mobileAuth.mockRejectedValue(new Error("MOBILE_UNAUTHORIZED"));const r=request();expect((await mobile(r)).status).toBe(401);expect(r.bodyUsed).toBe(false);expect(m.save).not.toHaveBeenCalled();
 });
 it("rejects missing entitlement before native body consumption",async()=>{
  m.entitlement.mockRejectedValue(new Error("SUBSCRIPTION_REQUIRED"));const r=request();expect((await mobile(r)).status).toBe(403);expect(r.bodyUsed).toBe(false);expect(m.save).not.toHaveBeenCalled();
 });
 it("uses native permission/entitlement and the established native receipt retry namespace",async()=>{
  expect((await mobile(request())).status).toBe(201);expect(m.permit).toHaveBeenCalledWith({id:"principal"},"ACCOUNT_JOURNAL_POST");expect(m.entitlement).toHaveBeenCalledWith("company");
  expect(m.save).toHaveBeenCalledWith({id:"native",companyId:"company"},{type:"SALES_INVOICE",idempotencyKey:"save-key"},{receivedAmount:"90"},"mobile-sale-receipt",[expect.any(File)]);
 });
 it("returns retry conflicts and redacts storage details",async()=>{
  m.save.mockRejectedValueOnce(new Error("IDEMPOTENCY_KEY_REUSED"));expect((await web(request())).status).toBe(409);
  m.save.mockRejectedValueOnce(new Error("storage-secret"));const failure=await mobile(request());expect(failure.status).toBe(503);expect(await failure.text()).not.toContain("storage-secret");
 });
 it("downloads through authenticated route-owned identities with private headers",async()=>{
  const r=new Request("http://example.test/");for(const get of [webDownload,mobileDownload]){const response=await get(r,context);expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");expect(await response.text()).toBe("%PDF-1.7")}
  expect(m.readAuth).toHaveBeenCalledWith("ACCOUNT_LEDGER_VIEW");expect(m.download).toHaveBeenCalledWith({id:"web-reader",companyId:"company"},"route-owned-id");expect(m.download).toHaveBeenCalledWith({id:"native",companyId:"company"},"route-owned-id");
 });
 it("lists native file metadata through a scoped read service and no-store response",async()=>{
  const response=await mobileList(new Request("http://example.test/"),context);expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");expect(m.list).toHaveBeenCalledWith({id:"native",companyId:"company"},"route-owned-id");
 });
});
