import "regenerator-runtime/runtime";
import type { CustomerQuotationDto } from "./service";
import { PDFDocument } from "pdf-lib";
import {createPdfTextLayout} from "@/lib/pdf/text-layout";
const address=(party:{addressLine1?:string|null;addressLine2?:string|null;locality?:string|null;city?:string|null;state?:string|null;postalCode?:string|null;country?:string|null})=>[party.addressLine1,party.addressLine2,party.locality,party.city,party.state,party.postalCode,party.country].filter(Boolean).join(", ");

function quotationText(revision:CustomerQuotationDto):string[] {
 const {document}=revision,company=document.company,branch=document.branch;
 return [`${document.documentType} ${document.documentNumber} / Revision ${revision.revisionNumber}`,company.name,address(company),[company.primaryPhone,company.contactEmail,company.website].filter(Boolean).join(" | "),`Company GSTIN: ${company.gstin??"-"} | PAN: ${company.pan??"-"} | Registration: ${company.registrationNumber??"-"}`,`Branch: ${branch.name} (${branch.code})`,address(branch),[branch.phone,branch.email,branch.gstin?`GSTIN ${branch.gstin}`:null].filter(Boolean).join(" | "),`Issue: ${revision.issueDate.toISOString().slice(0,10)}${revision.validUntil?` | Valid until: ${revision.validUntil.toISOString().slice(0,10)}`:""}`,`Customer/Lead: ${revision.customerName}`,`Contact: ${revision.contactPerson??"-"} | ${revision.phone??"-"} | ${revision.email??"-"}`,`Billing: ${revision.billingAddress??"-"}`,`Site: ${revision.siteAddress??"-"}`,`Customer GSTIN: ${revision.gstin??"-"} | PAN: ${revision.pan??"-"}`,...(revision.customFields??[]).map(field=>`${field.label}: ${field.value}`),"BOQ",...revision.lines.flatMap((line,index)=>[`${index+1}. ${line.itemName}${line.itemCode?` (${line.itemCode})`:""} [${line.unitSymbol??line.unitName??""}]`,`${line.description??""} ${line.specification??""}`,`Qty ${line.quantity} x Rate ${line.rate} = ${line.baseAmount} | Discount ${line.discountAmount} | Taxable ${line.taxableAmount} | GST ${line.taxRate}%: ${line.taxAmount} | Total ${line.lineTotal}`]),`Subtotal: ${revision.subtotal}`,`Discount total: ${revision.discountTotal}`,...revision.adjustments.map(item=>`${item.type==="DISCOUNT"?"Discount":"Additional charge"} - ${item.label}: ${item.amount}${item.taxable?` + tax ${item.taxAmount}`:""}`),`Additional charges: ${revision.additionalChargeTotal}`,`Taxable: ${revision.taxableTotal} | GST/Tax: ${revision.taxTotal}`,`GRAND TOTAL: ${revision.grandTotal}`,"Payment schedule",...revision.paymentSchedule.map(row=>`${row.label}: ${row.amount} ${row.dueDescription??""}`),`Terms: ${revision.terms??""}`,`Inclusions: ${revision.inclusions??""}`,`Exclusions: ${revision.exclusions??""}`,`Notes: ${revision.notes??""}`].filter(Boolean);
}

/** Only explicit customer DTO fields enter the PDF. Fonts and measured wrapping
 * retain Unicode text; no source IDs, internal costs or margins are serialized. */
export async function renderQuotationPdf(revision:CustomerQuotationDto) {
  const pdf=await PDFDocument.create();
  const layout=await createPdfTextLayout(pdf,"QUOTATION_PDF_UNSUPPORTED_CHARACTER");
  pdf.setTitle(`${revision.document.documentNumber} / Revision ${revision.revisionNumber}`);
  const pageWidth=595,pageHeight=842,margin=40,size=9,lineHeight=16;
  let page=pdf.addPage([pageWidth,pageHeight]),y=pageHeight-margin;
  for(const paragraph of quotationText(revision)) {
    for(const line of layout.lines(paragraph,size,pageWidth-2*margin)) {
      if(y<margin+lineHeight){page=pdf.addPage([pageWidth,pageHeight]);y=pageHeight-margin;}
      let x=margin;
      for(const run of layout.runs(line)) {
        page.drawText(run.text,{x,y,size,font:run.font});
        x+=run.font.widthOfTextAtSize(run.text,size);
      }
      y-=lineHeight;
    }
  }
  return Buffer.from(await pdf.save({useObjectStreams:false}));
}
