import {AuthenticationError} from "@/lib/auth/authorization";
import {describe,expect,it,vi} from "vitest";
vi.mock("@/lib/db",()=>({db:{}}));
import {quotationAttachmentForm,quotationAttachmentFailure,quotationAttachmentResponse} from "./attachment-http";
import {QuotationAttachmentError} from "./attachments";
describe("bounded private quotation attachment HTTP",()=>{
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
