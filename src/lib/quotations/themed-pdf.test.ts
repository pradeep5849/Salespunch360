import {describe,it,expect} from "vitest";
import {PDFDocument} from "pdf-lib";
import {renderQuotationPdf} from "./pdf";
import {extractPdfText} from "../../../tests/helpers/pdf-text";
import {QUOTATION_THEMES,quotationThemeSchema} from "./theme-catalogue";
const dto={revisionNumber:2,issueDate:new Date("2026-09-10"),validUntil:new Date("2026-10-10"),customerName:"Acme",contactPerson:"Buyer",phone:"1",email:"a@example.com",billingAddress:"Billing",siteAddress:"Site",gstin:"GST",pan:"PAN",terms:"Terms",inclusions:"Included",exclusions:"Excluded",notes:"Notes",subtotal:{toString:()=>"100"},discountTotal:{toString:()=>"10"},additionalChargeTotal:{toString:()=>"5"},taxableTotal:{toString:()=>"95"},taxTotal:{toString:()=>"17.1"},grandTotal:{toString:()=>"112.1"},lines:[{position:0,lineType:"CUSTOM",itemName:"Work",itemCode:null,description:"Description",specification:"Materials",unitName:"Number",unitSymbol:"Nos",quantity:{toString:()=>"1"},rate:{toString:()=>"100"},discountType:"FIXED",discountValue:{toString:()=>"10"},baseAmount:{toString:()=>"100"},discountAmount:{toString:()=>"10"},taxableAmount:{toString:()=>"90"},taxRate:{toString:()=>"18"},taxAmount:{toString:()=>"16.2"},lineTotal:{toString:()=>"106.2"}}],adjustments:[{position:0,type:"ADDITIONAL_CHARGE",label:"Freight",valueType:"FIXED",value:{toString:()=>"5"},amount:{toString:()=>"5"},taxable:true,taxRate:{toString:()=>"18"},taxAmount:{toString:()=>"0.9"}}],paymentSchedule:[{position:0,label:"Advance",valueType:"PERCENTAGE",value:{toString:()=>"100"},amount:{toString:()=>"112.1"},dueDescription:"Now"}],document:{documentType:"QUOTATION",documentNumber:"Q-1",company:{name:"Seller",addressLine1:"Address",addressLine2:null,locality:null,city:"City",state:"State",postalCode:"1",country:"India",primaryContactName:"Owner",primaryPhone:"2",contactEmail:"s@example.com",website:"example.com",gstin:"SGST",pan:"SPAN",registrationNumber:"REG"},branch:{name:"Main",code:"M",addressLine1:"Branch address",addressLine2:null,locality:null,city:"City",state:"State",postalCode:"1",country:"India",phone:"3",email:"b@example.com",gstin:"BGST"}}};
describe("15 customer-safe quotation layouts",()=>{
 it.each(QUOTATION_THEMES)("renders $name with retained amounts and correct paper orientation",async theme=>{
  const data={...dto,printPresentation:{theme:theme.id,color:"#998BDF",amountWordsFormat:"INDIAN"},internalCost:"PRIVATE-COST"};
  const bytes=await renderQuotationPdf(data as never),pdf=await PDFDocument.load(bytes),{text}=await extractPdfText(bytes);
  expect(pdf.getPage(0).getWidth()>pdf.getPage(0).getHeight()).toBe(theme.id.startsWith("LANDSCAPE"));
  for(const value of ["Q-1","Seller","Acme","Work","Freight","Advance","Terms","Included","Excluded","112.10"])expect(text).toContain(value);
  expect(text).not.toContain("PRIVATE-COST");expect(text).not.toContain("Tax Invoice");
  expect(text.includes("Acknowledgement")).toBe(theme.ack);expect(dto.grandTotal.toString()).toBe("112.1");
 },20000);
 it("retains multilingual long items and notes across pages without inventing payment balances",async()=>{
  const data={...dto,customerName:"José Café",printPresentation:{theme:"GST_6",color:"#087FA0",amountWordsFormat:"INDIAN"},lines:Array.from({length:35},(_,i)=>({...dto.lines[0],itemName:`Item-${i} ಕನ್ನಡ`,description:`Description-${i} `+"words ".repeat(40)})),notes:"अजय सेवा FINAL-NOTE"};
  const {text,pages}=await extractPdfText(await renderQuotationPdf(data as never));expect(pages).toBeGreaterThan(2);for(const value of ["Item-0","Item-34","FINAL-NOTE","अजय","ಕನ್ನಡ"])expect(text).toContain(value);expect(text).not.toContain("Received:");expect(text).not.toContain("Balance due");
 },30000);
 it("rejects CSS/URL payloads and unknown theme identities",()=>{
  for(const raw of [{theme:"GST_99",color:"#998BDF"},{theme:"GST_1",color:"url(example.test)"},{theme:"GST_1",color:"#fff",privateKey:"hidden"}])expect(quotationThemeSchema.safeParse(raw).success).toBe(false);
  expect(quotationThemeSchema.parse({theme:"GST_1",color:"#abc123"})).toEqual({theme:"GST_1",color:"#ABC123"});
 });
 it("applies saved currency precision calendar and supply labels in a named layout",async()=>{
  const data={...dto,stateOfSupplyCode:"29",displayPreferences:{appLanguage:"en",baseCurrency:"USD",displayDecimalPlaces:3,dateFormat:"MM/DD/YYYY"},printPresentation:{theme:"GST_2",color:"#087FA0",amountWordsFormat:"INTERNATIONAL"}};
  const {text}=await extractPdfText(await renderQuotationPdf(data as never));expect(text).toContain("$112.100");expect(text).toContain("Date: 09/10/2026");expect(text).toContain("Karnataka");expect(text).not.toContain("₹");expect(dto.grandTotal.toString()).toBe("112.1");
 });

});
