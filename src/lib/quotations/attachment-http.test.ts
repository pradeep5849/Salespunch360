import {AuthenticationError} from "@/lib/auth/authorization";
import {describe,expect,it,vi} from "vitest";
vi.mock("@/lib/db",()=>({db:{}}));
import {quotationAttachmentForm,quotationCreationForm,quotationAttachmentFailure,quotationAttachmentResponse} from "./attachment-http";
import {QuotationAttachmentError} from "./attachments";
describe("bounded private quotation attachment HTTP",()=>{
 it("parses creation files and custom fields without persisting an implicit document",async()=>{
  const body=new FormData();body.set("document",JSON.stringify({branchId:"branch",customFields:{old:"old"}}));body.set("creationRequestKey","key");body.set("custom_text","hello");
  body.append("attachments",new File(["%PDF-1.7"],"plan.pdf",{type:"application/pdf"}));
  const parsed=await quotationCreationForm(new Request("http://example.test/",{method:"POST",body}));
  expect(parsed.document).toEqual({branchId:"branch",customFields:{text:"hello"},creationRequestKey:"key"});expect(parsed.files).toHaveLength(1);
 });
 it("rejects nonobject creation JSON and nonfile attachment entries",async()=>{
  for(const value of ["null","[]","broken"]){const body=new FormData();body.set("document",value);await expect(quotationCreationForm(new Request("http://example.test/",{method:"POST",body}))).rejects.toThrow("INVALID_INPUT")}
  const body=new FormData();body.set("document","{}");body.set("attachments","not a file");await expect(quotationCreationForm(new Request("http://example.test/",{method:"POST",body}))).rejects.toThrow("INVALID_QUOTATION_ATTACHMENT");
  expect(quotationAttachmentFailure(new Error("IDEMPOTENCY_KEY_REUSED")).status).toBe(409);
 });
 it("parses a bounded multipart upload without trusting a filename as a storage key",async()=>{
  const body=new FormData();body.set("file",new File(["%PDF-1.7"],"../../Plan.pdf",{type:"application/pdf"}));body.set("revisionNumber","0");body.set("requestKey","key");
  const parsed=await quotationAttachmentForm(new Request("http://example.test/",{method:"POST",body}));
  expect(parsed.revisionNumber).toBe(0);expect(parsed.requestKey).toBe("key");expect(await parsed.file.text()).toBe("%PDF-1.7");
 });
 it("rejects declared oversized or malformed bodies",async()=>{
  await expect(quotationAttachmentForm(new Request("http://example.test/",{method:"POST",body:"x",headers:{"content-length":String(12*1024*1024)}}))).rejects.toThrow("INVALID_QUOTATION_ATTACHMENT");
  await expect(quotationAttachmentForm(new Request("http://example.test/",{method:"POST",body:"broken",headers:{"content-type":"multipart/form-data;boundary=broken"}}))).rejects.toThrow("INVALID_QUOTATION_ATTACHMENT");
 });
 it("bounds actual streamed bytes even when content-length is omitted",async()=>{
  let canceled=false;const chunk=new Uint8Array(1024*1024),body=new ReadableStream({pull(c){c.enqueue(chunk)},cancel(){canceled=true}});
  await expect(quotationAttachmentForm(new Request("http://example.test/",{method:"POST",body,duplex:"half"} as RequestInit))).rejects.toThrow("INVALID_QUOTATION_ATTACHMENT");expect(canceled).toBe(true);
 });
 it("uses private download headers and never interpolates a filename into headers unescaped",()=>{
  const result=quotationAttachmentResponse({data:Buffer.from("%PDF-"),mimeType:"application/pdf",name:'Plan\r\n"x.pdf'});
  expect(result.headers.get("cache-control")).toBe("private, no-store");expect(result.headers.get("x-content-type-options")).toBe("nosniff");expect(result.headers.get("content-disposition")).toContain("%0D%0A%22");
 });
 it("returns actionable conflicts and redacts unexpected storage/database errors",async()=>{
  expect(quotationAttachmentFailure(new QuotationAttachmentError("QUOTATION_REVISION_CHANGED")).status).toBe(409);
  const failure=quotationAttachmentFailure(new Error("postgresql://private-secret"));expect(failure.status).toBe(503);expect(await failure.text()).not.toContain("private-secret");
  expect(quotationAttachmentFailure(new Error("SUBSCRIPTION_REQUIRED")).status).toBe(403);expect(quotationAttachmentFailure(new AuthenticationError()).status).toBe(401);
 });
});
