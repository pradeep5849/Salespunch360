import { afterEach, describe, expect, it, vi } from "vitest";
import { appendSaleWithAttachments,submitSaleWithAttachments } from "./sale-attachment-upload";
afterEach(()=>vi.unstubAllGlobals());
describe("explicit Sale file submission",()=>{
 it("sends original files and stable document/payment intent in one multipart request",async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,id:"saved",documentNumber:"INV-1"},{status:201}));vi.stubGlobal("fetch",fetcher);
  const document={type:"SALES_INVOICE",idempotencyKey:"stable-key"},payment={receivedAmount:"90"},file=new File(["%PDF-1.7"],"plan.pdf",{type:"application/pdf"});
  expect(await submitSaleWithAttachments(document,payment,[file])).toEqual({ok:true,id:"saved",documentNumber:"INV-1"});
  const [url,init]=fetcher.mock.calls[0];expect(url).toBe("/api/account/sales/with-attachments");expect(init.method).toBe("POST");expect(init.credentials).toBe("same-origin");expect(init.headers).toBeUndefined();
  expect(JSON.parse(init.body.get("document"))).toEqual(document);expect(JSON.parse(init.body.get("payment"))).toEqual(payment);expect(await init.body.getAll("attachments")[0].text()).toBe("%PDF-1.7");
 });
 it("preserves retry conflicts and does not silently retry a financial Save",async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({ok:false,errorCode:"IDEMPOTENCY_KEY_REUSED",message:"Review saved details"},{status:409}));vi.stubGlobal("fetch",fetcher);
  expect(await submitSaleWithAttachments({idempotencyKey:"stable-key"},{},[])).toEqual({ok:false,errorCode:"IDEMPOTENCY_KEY_REUSED",message:"Review saved details"});expect(fetcher).toHaveBeenCalledOnce();
 });
 it("addresses corrections through PATCH and keeps the route source separate from payload identity",async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,id:"corrected",documentNumber:"INV-2"}));vi.stubGlobal("fetch",fetcher);
  expect((await submitSaleWithAttachments({idempotencyKey:"stable"},{},[],"source/one")).ok).toBe(true);
  expect(fetcher.mock.calls[0][0]).toBe("/api/account/sales/source%2Fone/with-attachments");expect(fetcher.mock.calls[0][1].method).toBe("PATCH");
 });
 it("sends file-only append without any invoice or payment payload",async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,attachments:[]},{status:201}));vi.stubGlobal("fetch",fetcher);
  expect(await appendSaleWithAttachments("source","append-key",[new File(["%PDF-1.7"],"support.pdf")])).toEqual({ok:true});
  const [url,init]=fetcher.mock.calls[0];expect(url).toBe("/api/account/sales/source/attachments");expect(init.body.get("requestKey")).toBe("append-key");expect(init.body.has("document")).toBe(false);expect(init.body.has("payment")).toBe(false);
 });
 it("handles expired-session HTML or malformed success without claiming a saved Sale",async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response("<html>Sign in</html>",{status:200})).mockResolvedValueOnce(Response.json({ok:true},{status:201}));vi.stubGlobal("fetch",fetcher);
  expect((await submitSaleWithAttachments({}, {}, [])).ok).toBe(false);expect((await submitSaleWithAttachments({}, {}, [])).ok).toBe(false);
 });
 it("propagates a network failure while leaving caller-owned selection and identity intact",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));const files=[new File(["%PDF-1.7"],"plan.pdf")],document={idempotencyKey:"stable-key"};
  await expect(submitSaleWithAttachments(document,{},files)).rejects.toThrow("offline");expect(files).toHaveLength(1);expect(document.idempotencyKey).toBe("stable-key");
 });
});
