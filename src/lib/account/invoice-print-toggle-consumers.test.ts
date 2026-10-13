import {describe,expect,it,vi} from "vitest";
import {PDFDocument,PDFRawStream,PDFName,decodePDFRawStream} from "pdf-lib";
vi.mock("@/lib/db",()=>({db:{}}));
vi.mock("@/lib/auth/authorization",()=>({requirePermission:vi.fn()}));
import {applyInvoicePrintPreferences} from "./invoice-print-preferences";
import {renderAccountPrintHtml,renderAccountPrintPdf} from "./print-renderer";

const invoice={title:"Invoice",number:"INV-1",date:"11/10/2026",company:"Company name",branch:"Main",party:"Buyer",companyAddress:"Office address",companyGstin:"GST-COMPANY",companyPhone:"123456",companyEmail:"test@example.test",lines:[{description:"Product",detail:"Special description",quantity:"1",rate:"100",taxable:"100",tax:"18",total:"118"}],subtotal:"100",cgst:"9",sgst:"9",igst:"0",cess:"0",total:"118",receivedAmount:"50",balanceAmount:"68",partyCurrentBalance:"268",discountAmount:"10",terms:"Saved terms",authorizedSignatory:"Director",paymentMode:"CASH"};

describe("invoice print toggle consumers",()=>{
 it.each([true,false])("uses regular printer default=%s for actual PDF paper",async regularDefault=>{
  const {document,paper}=applyInvoicePrintPreferences("SALES_INVOICE",invoice,"A4",{regularDefault,printer:regularDefault?"THERMAL":"REGULAR",pageSize:"A4"});
  const pdf=await PDFDocument.load(await renderAccountPrintPdf(document,paper));expect(pdf.getPage(0).getWidth()).toBe(regularDefault?595:227);
 });
 it("hides disabled header, payment and footer information from output",()=>{
  const {document}=applyInvoicePrintPreferences("SALES_INVOICE",invoice,"A4",{printCompanyName:false,address:false,gstinOnSale:false,phone:false,email:false,termsEnabled:false,signatureText:false,paymentMode:false,receivedBy:false,deliveredBy:false,acknowledgement:false});
  const html=renderAccountPrintHtml(document);
  for(const hidden of [invoice.company,invoice.companyAddress,invoice.companyGstin,invoice.companyPhone,invoice.companyEmail,invoice.terms,invoice.authorizedSignatory,"Payment mode:","Received by:","Delivered by:","Acknowledgement:"])expect(html).not.toContain(hidden);
 });
 it.each([true,false])("applies financial and item visibility switches=%s",enabled=>{
  const html=renderAccountPrintHtml({...invoice,printOptions:{receivedAmount:enabled,balanceAmount:enabled,partyCurrentBalance:enabled,taxDetails:enabled,youSaved:enabled,totalItemQuantity:enabled,printDescription:enabled}});
  for(const label of ["Received","Balance due","Party current balance","CGST","SGST","You saved","Total quantity"])expect(html.includes(`<span>${label}</span>`)).toBe(enabled);
  expect(html.includes(invoice.lines[0].detail)).toBe(enabled);
  expect(html).toContain("Grand total");
 });
 it("changes company name size in the generated PDF",async()=>{
  for(const [companyNameTextSize,expected] of [["SMALL",14],["LARGE",20]] as const){
   const pdf=await PDFDocument.load(await renderAccountPrintPdf({...invoice,printOptions:{companyNameTextSize}}));
   const content=pdf.context.enumerateIndirectObjects().flatMap(([,object])=>object instanceof PDFRawStream&&object.dict.get(PDFName.of("Filter"))?[Buffer.from(decodePDFRawStream(object).decode()).toString()]:[]).join("\n");
   expect(content).toContain(` ${expected} Tf`);
  }
 });
 it.each([true,false])("applies repeated headers and page numbers to multipage PDFs=%s",async enabled=>{
  const pdf=await PDFDocument.load(await renderAccountPrintPdf({...invoice,lines:Array.from({length:80},()=>invoice.lines[0]),printOptions:{repeatHeader:enabled,pageNumbers:enabled}}));
  expect(pdf.getPageCount()).toBeGreaterThan(1);
  const content=pdf.context.enumerateIndirectObjects().flatMap(([,object])=>object instanceof PDFRawStream&&object.dict.get(PDFName.of("Filter"))?[Buffer.from(decodePDFRawStream(object).decode()).toString().toLowerCase()]:[]).join("\n");
  const companyText=Buffer.from(invoice.company).toString("hex");
  expect(content.split(`<${companyText}>`).length-1).toBe(enabled?pdf.getPageCount():1);
  for(let index=1;index<=pdf.getPageCount();index++)expect(content.includes(`<${Buffer.from(`${index} / ${pdf.getPageCount()}`).toString("hex")}>`)).toBe(enabled);
 });
});

it("retains Unicode invoice text and exact large amounts in PDF and HTML",async()=>{
 const {extractPdfText}=await import("../../../tests/helpers/pdf-text");
 const document={...invoice,company:"José Café",party:"अजय सेवा ಕನ್ನಡ",total:"9999999999999999.99",printOptions:{amountGrouping:true,amountWordsFormat:"INTERNATIONAL",theme:"MODERN"}};
 const {text}=await extractPdfText(await renderAccountPrintPdf(document));
 for(const value of ["José Café","अजय","सेवा","ಕನ್ನಡ","9,999,999,999,999,999.99"])expect(text).toContain(value);
 expect(renderAccountPrintHtml(document)).toContain("9,999,999,999,999,999.99");
});

it("uses the configured theme in PDF and hides HSN with an omitted item column",async()=>{
 const document={...invoice,lines:[{...invoice.lines[0],hsn:"HSN-PRIVATE"}],printOptions:{theme:"MODERN",itemTableColumns:"QTY,AMOUNT"}};
 const pdf=await PDFDocument.load(await renderAccountPrintPdf(document));
 const content=pdf.context.enumerateIndirectObjects().flatMap(([,object])=>object instanceof PDFRawStream&&object.dict.get(PDFName.of("Filter"))?[Buffer.from(decodePDFRawStream(object).decode()).toString()]:[]).join("\n");
 expect(content).toContain("0.058823529411764705 0.4627450980392157 0.43137254901960786 rg");
 const {extractPdfText}=await import("../../../tests/helpers/pdf-text");
 expect((await extractPdfText(await renderAccountPrintPdf(document))).text).not.toContain("HSN-PRIVATE");
 expect(renderAccountPrintHtml(document)).not.toContain("HSN-PRIVATE");
});
it("paginates unusually long first-page headers without recursively repeating them",async()=>{
 const {extractPdfText}=await import("../../../tests/helpers/pdf-text");
 const document={...invoice,companyAddress:Array.from({length:120},(_,i)=>`Address line ${i}`).join("\n"),printOptions:{repeatHeader:true}};
 const {text,pages}=await extractPdfText(await renderAccountPrintPdf(document));
 expect(pages).toBeGreaterThan(2);expect(text).toContain("Address line 119");expect(text).toContain("Grand total");
});

it("rejects unsupported glyphs rather than silently replacing them",async()=>{await expect(renderAccountPrintPdf({...invoice,party:"Unsupported 🦄"})).rejects.toThrow("ACCOUNT_PDF_UNSUPPORTED_CHARACTER");expect(renderAccountPrintHtml({...invoice,party:"Unsupported 🦄"})).toContain("Unsupported 🦄")});
