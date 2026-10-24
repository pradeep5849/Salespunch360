import {describe,it,expect,vi} from "vitest";
vi.mock("@/lib/auth/authorization",()=>({AuthenticationError:class extends Error{},AuthorizationError:class extends Error{}}));
vi.mock("./action-feedback",()=>({accountErrorMessage:()=>"Review the transfer configuration."}));
import {AuthenticationError,AuthorizationError} from "@/lib/auth/authorization";
import {partyTransferForm,partyTransferFailure,partyTransferDto,partyTransferPhotoResponse} from "./party-transfer-http";
const request=(form:FormData)=>new Request("http://localhost/api/account/party-transfers",{method:"POST",body:form});
describe("party transfer HTTP boundary",()=>{
 it("accepts one document and optional raster file without inventing policy fields",async()=>{
  const form=new FormData();form.set("document",JSON.stringify({receivedAmount:"600",paidAmount:"500"}));form.set("photo",new File(["bytes"],"photo.png",{type:"image/png"}));
  const result=await partyTransferForm(request(form));expect(result.input).toEqual({receivedAmount:"600",paidAmount:"500"});expect(result.file?.name).toBe("photo.png");
 });
 it.each(["duplicate","unexpected","malformed","fileDocument","textPhoto"])("rejects ambiguous or invalid multipart: %s",async mode=>{
  const form=new FormData();form.set("document","{}");
  if(mode==="duplicate")form.append("document","{}");
  if(mode==="unexpected")form.set("companyId","foreign");
  if(mode==="malformed")form.set("document","{");
  if(mode==="fileDocument")form.set("document",new File(["{}"],"document.json"));
  if(mode==="textPhoto")form.set("photo","private-key");
  await expect(partyTransferForm(request(form))).rejects.toThrow("INVALID_PARTY_TRANSFER_FORM");
 });
 it.each([[new AuthenticationError(),401],[new AuthorizationError(),403],[new Error("MOBILE_UNAUTHORIZED"),401],[new Error("SUBSCRIPTION_REQUIRED"),403],[new Error("RATE_LIMITED"),429],[new Error("PARTY_TRANSFER_NOT_FOUND"),404],[new Error("IDEMPOTENCY_KEY_REUSED"),409],[new Error("PARTY_TRANSFER_ALREADY_REVERSED"),409],[new Error("MISSING_SYSTEM_ACCOUNT"),409],[new SyntaxError("internal parse details"),400],[new Error("INVALID_PARTY_TRANSFER_PARTY"),400],[new Error("database password must stay private"),503]])("maps controlled errors without leaking internals",async(error,status)=>{
  const response=partyTransferFailure(error);expect(response.status).toBe(status);expect(response.headers.get("cache-control")).toContain("no-store");expect(await response.text()).not.toContain("password");
 });
 it("returns a narrow DTO and keeps private storage and request hashes server-side",()=>{
  const row={id:"id",number:"PT-1",branchId:"branch",moneyAccountId:"cash",transactionDate:"2026-10-23",receivedParty:{kind:"CUSTOMER" as const,id:"a"},paidParty:{kind:"VENDOR" as const,id:"b"},receivedPartyName:"A",paidPartyName:"B",receivedAmount:"600.00",paidAmount:"500.00",passThroughAmount:"500.00",commissionAmount:"100.00",commissionHead:"OTHER_INCOME" as const,expenseAmount:"0.00" as const,notes:"note",createdAt:new Date("2026-10-23"),version:1 as const,requestHash:"private-request-hash",photoObjectKey:"private-object",photoSha256:"private-checksum",photoMimeType:"image/webp" as const,passReceiptJournalId:null,passPaymentJournalId:null,commissionIncomeId:null};
  const dto=partyTransferDto(row);expect(dto.hasPhoto).toBe(true);expect(dto.commissionAmount).toBe("100.00");for(const key of ["requestHash","photoObjectKey","photoSha256","passReceiptJournalId","passPaymentJournalId"])expect(dto).not.toHaveProperty(key);
 });
 it("serves authorized photos as private non-sniffable WebP",async()=>{
  const response=partyTransferPhotoResponse({bytes:Buffer.from("raster"),mimeType:"image/webp"});expect(response.headers.get("content-type")).toBe("image/webp");expect(response.headers.get("x-content-type-options")).toBe("nosniff");expect(response.headers.get("cache-control")).toContain("no-store");expect(await response.text()).toBe("raster");
 });
});
