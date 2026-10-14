import {randomUUID} from "node:crypto";
import {describe,it,expect} from "vitest";
import {invoiceShareUrl,verifyInvoiceShareToken} from "./invoice-share";

describe("invoice sharing capability",()=>{
 const now=new Date("2026-10-11T12:00:00Z"),invoice={companyId:randomUUID(),branchId:randomUUID(),id:randomUUID(),updatedAt:now};
 const token=()=>new URL(invoiceShareUrl(invoice,now)).pathname.split("/").at(-1)!;
 it("binds access to one company, branch, invoice and version",()=>{
  expect(verifyInvoiceShareToken(token(),now)).toEqual({companyId:invoice.companyId,branchId:invoice.branchId,id:invoice.id,version:now.toISOString(),expires:now.getTime()+30*86400000});
 });
 it("rejects changing invoice identity while retaining the signature",()=>{
  const [payload,signature]=token().split("."),claims=JSON.parse(Buffer.from(payload,"base64url").toString());claims.id=randomUUID();
  expect(verifyInvoiceShareToken(`${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`,now)).toBeNull();
 });
 it("rejects expired, malformed and oversized links",()=>{
  expect(verifyInvoiceShareToken(token(),new Date(now.getTime()+30*86400000))).toBeNull();
  for(const value of ["","abc","a.b.c","x".repeat(1025),`${token()}x`])expect(verifyInvoiceShareToken(value,now)).toBeNull();
 });
});
