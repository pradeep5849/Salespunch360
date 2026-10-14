import {describe,expect,it} from "vitest";
import {renderQuotationPdf} from "./pdf";
import {extractPdfText} from "../../../tests/helpers/pdf-text";
const dto={revisionNumber:2,issueDate:new Date("2026-09-10"),validUntil:new Date("2026-10-10"),customerName:"Acme",contactPerson:"Buyer",phone:"1",email:"a@example.com",billingAddress:"Billing",siteAddress:"Site",gstin:"GST",pan:"PAN",terms:"Terms",inclusions:"Included",exclusions:"Excluded",notes:"Notes",subtotal:{toString:()=>"100"},discountTotal:{toString:()=>"10"},additionalChargeTotal:{toString:()=>"5"},taxableTotal:{toString:()=>"95"},taxTotal:{toString:()=>"17.1"},grandTotal:{toString:()=>"112.1"},lines:[{position:0,lineType:"CUSTOM",itemName:"Work",itemCode:null,description:"Description",specification:"Materials",unitName:"Number",unitSymbol:"Nos",quantity:{toString:()=>"1"},rate:{toString:()=>"100"},discountType:"FIXED",discountValue:{toString:()=>"10"},baseAmount:{toString:()=>"100"},discountAmount:{toString:()=>"10"},taxableAmount:{toString:()=>"90"},taxRate:{toString:()=>"18"},taxAmount:{toString:()=>"16.2"},lineTotal:{toString:()=>"106.2"}}],adjustments:[{position:0,type:"ADDITIONAL_CHARGE",label:"Freight",valueType:"FIXED",value:{toString:()=>"5"},amount:{toString:()=>"5"},taxable:true,taxRate:{toString:()=>"18"},taxAmount:{toString:()=>"0.9"}}],paymentSchedule:[{position:0,label:"Advance",valueType:"PERCENTAGE",value:{toString:()=>"100"},amount:{toString:()=>"112.1"},dueDescription:"Now"}],document:{documentType:"QUOTATION",documentNumber:"Q-1",company:{name:"Seller",addressLine1:"Address",addressLine2:null,locality:null,city:"City",state:"State",postalCode:"1",country:"India",primaryContactName:"Owner",primaryPhone:"2",contactEmail:"s@example.com",website:"example.com",gstin:"SGST",pan:"SPAN",registrationNumber:"REG"},branch:{name:"Main",code:"M",addressLine1:"Branch address",addressLine2:null,locality:null,city:"City",state:"State",postalCode:"1",country:"India",phone:"3",email:"b@example.com",gstin:"BGST"}}};
describe("customer Unicode PDF",()=>{
 it("contains required safe customer content in a parseable embedded-font PDF",async()=>{
  const pdf=await renderQuotationPdf(dto as never),{text,pages}=await extractPdfText(pdf);
  expect(pdf.subarray(0,4).toString()).toBe("%PDF");expect(pages).toBeGreaterThan(0);
  for(const value of ["Seller","Q-1","Acme","Materials","Freight","Advance","Terms","Included","Excluded"])expect(text).toContain(value);
 });
 it("retains accented, Hindi and Kannada customer text and rupee values",async()=>{
  const data={...dto,customerName:"José Café",notes:"अजय सेवा ಕನ್ನಡ ₹125"};
  const {text}=await extractPdfText(await renderQuotationPdf(data as never));
  for(const value of ["José Café","अजय","सेवा","ಕನ್ನಡ","₹125"])expect(text).toContain(value);
  expect(text).not.toContain("????");
 });
 it("wraps long words and multiline notes over pages without losing content",async()=>{
  const notes=Array.from({length:90},(_,i)=>`Row-${i} ${"abcdefghij".repeat(20)}`).join("\n");
  const {text,pages}=await extractPdfText(await renderQuotationPdf({...dto,notes} as never));
  expect(pages).toBeGreaterThan(2);expect(text).toContain("Row-0");expect(text).toContain("Row-89");
  expect(text.replace(/\s/g,"")).toContain("abcdefghij".repeat(20));
 },15000);
 it("escapes PDF operators and retains literal customer punctuation",async()=>{
  const notes="Literal (customer) \\ BT /F1 999 Tf <00> Tj ET";
  const {text,pages}=await extractPdfText(await renderQuotationPdf({...dto,notes} as never));
  expect(text).toContain(notes);expect(pages).toBe(1);
 });
 it("does not serialize private fields even if an extra property reaches the renderer",async()=>{
  const data={...dto,internalCost:"SECRET-COST-9000",expectedProfit:"SECRET-PROFIT",companyId:"PRIVATE-COMPANY",lines:dto.lines.map(line=>({...line,internalUnitCost:"SECRET-LINE-COST"}))};
  const pdf=await renderQuotationPdf(data as never),{text}=await extractPdfText(pdf);
  expect(text).not.toMatch(/SECRET|PRIVATE-COMPANY|internalCost|expectedProfit|companyId/);
  expect(pdf.toString()).not.toMatch(/SECRET-COST|SECRET-PROFIT|PRIVATE-COMPANY|SECRET-LINE-COST/);
 });
});
