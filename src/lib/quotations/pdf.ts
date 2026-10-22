import {renderThemedQuotationPdf} from "./themed-pdf";
import {gstStateName} from "@/lib/account/gst-states";
import {formatCalendarDate,formatMoney,resolveDisplayPreferences} from "@/lib/account/display-preferences";
import "regenerator-runtime/runtime";
import type { CustomerQuotationDto } from "./service";
import { PDFDocument,rgb } from "pdf-lib";
import {quotationPdfTheme} from "./print-presentation";
import {printableAmountWords} from "@/lib/account/print-renderer";
import {createPdfTextLayout} from "@/lib/pdf/text-layout";
const address=(party:{addressLine1?:string|null;addressLine2?:string|null;locality?:string|null;city?:string|null;state?:string|null;postalCode?:string|null;country?:string|null})=>[party.addressLine1,party.addressLine2,party.locality,party.city,party.state,party.postalCode,party.country].filter(Boolean).join(", ");

function quotationText(revision:CustomerQuotationDto):string[] {
 const {document}=revision,company=document.company,branch=document.branch;
 const preferences=resolveDisplayPreferences(revision.displayPreferences),money=(value:{toString():string}|number)=>formatMoney(value,preferences),date=(value:Date)=>formatCalendarDate(value,preferences);
 return [`${document.documentType} ${document.documentNumber} / Revision ${revision.revisionNumber}`,company.name,address(company),[company.primaryPhone,company.contactEmail,company.website].filter(Boolean).join(" | "),`Company GSTIN: ${company.gstin??"-"} | PAN: ${company.pan??"-"} | Registration: ${company.registrationNumber??"-"}`,`Branch: ${branch.name} (${branch.code})`,address(branch),[branch.phone,branch.email,branch.gstin?`GSTIN ${branch.gstin}`:null].filter(Boolean).join(" | "),`Issue: ${date(revision.issueDate)}${revision.validUntil?` | Valid until: ${date(revision.validUntil)}`:""}`,`Customer/Lead: ${revision.customerName}`,revision.billingName?`Billing name: ${revision.billingName}`:"",`Contact: ${revision.contactPerson??"-"} | ${revision.phone??"-"} | ${revision.email??"-"}`,`Billing: ${revision.billingAddress??"-"}`,`Site: ${revision.siteAddress??"-"}`,`Customer GSTIN: ${revision.gstin??"-"} | PAN: ${revision.pan??"-"}`,`State of supply: ${gstStateName(revision.stateOfSupplyCode)||"Not recorded"}`,`Rates: tax ${revision.taxMode==="INCLUSIVE"?"inclusive":"exclusive"}`,...(revision.customFields??[]).map(field=>`${field.label}: ${field.value}`),"BOQ",...revision.lines.flatMap((line,index)=>[`${index+1}. ${line.itemName}${line.itemCode?` (${line.itemCode})`:""} [${line.unitSymbol??line.unitName??""}]`,`${line.description??""} ${line.specification??""}`,`Qty ${line.quantity} x Rate ${money(line.rate)} = ${money(line.baseAmount)} | Discount ${money(line.discountAmount)} | Taxable ${money(line.taxableAmount)} | GST ${line.taxRate}%: ${money(line.taxAmount)} | Total ${money(line.lineTotal)}`]),`Subtotal: ${money(revision.subtotal)}`,`Discount total: ${money(revision.discountTotal)}`,...revision.adjustments.map(item=>`${item.type==="DISCOUNT"?"Discount":"Additional charge"} - ${item.label}: ${money(item.amount)}${item.taxable?` + tax ${money(item.taxAmount)}`:""}`),`Additional charges: ${money(revision.additionalChargeTotal)}`,`Taxable: ${money(revision.taxableTotal)} | GST/Tax: ${money(revision.taxTotal)}`,`Round off: ${money(revision.roundOffAmount??0)}`,`GRAND TOTAL: ${money(revision.grandTotal)}`,`Amount in words: ${printableAmountWords(revision.grandTotal.toString(),preferences.baseCurrency,revision.printPresentation?.amountWordsFormat)}`,"Payment schedule",...revision.paymentSchedule.map(row=>`${row.label}: ${money(row.amount)} ${row.dueDescription??""}`),`Terms: ${revision.terms??""}`,`Inclusions: ${revision.inclusions??""}`,`Exclusions: ${revision.exclusions??""}`,`Notes: ${revision.notes??""}`].filter(Boolean);
}

/** Only explicit customer DTO fields enter the PDF. Fonts and measured wrapping
 * retain Unicode text; no source IDs, internal costs or margins are serialized. */
export async function renderQuotationPdf(revision:CustomerQuotationDto) {
  if(quotationPdfTheme(revision.printPresentation).profile)return renderThemedQuotationPdf(revision);
  const pdf=await PDFDocument.create();
  const layout=await createPdfTextLayout(pdf,"QUOTATION_PDF_UNSUPPORTED_CHARACTER");
  pdf.setTitle(`${revision.document.documentNumber} / Revision ${revision.revisionNumber}`);
  const theme=quotationPdfTheme(revision.printPresentation),accent=rgb(...[1,3,5].map(start=>parseInt(theme.color.slice(start,start+2),16)/255) as [number,number,number]);
  const pageWidth=595,pageHeight=842,margin=theme.margin,size=9,lineHeight=16;
  let page=pdf.addPage([pageWidth,pageHeight]),y=pageHeight-margin;
  async function drawImage(dataUrl:string,maxWidth:number,maxHeight:number){
    if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl))throw new Error("QUOTATION_PRINT_ASSET_INVALID");
    const image=await pdf.embedPng(Buffer.from(dataUrl.split(",")[1],"base64")),scale=Math.min(maxWidth/image.width,maxHeight/image.height,1),width=image.width*scale,height=image.height*scale;
    if(y<margin+height+lineHeight){page=pdf.addPage([pageWidth,pageHeight]);y=pageHeight-margin;}
    page.drawImage(image,{x:margin,y:y-height,width,height});y-=height+lineHeight;
  }
  if(revision.printAssets?.logoDataUrl)await drawImage(revision.printAssets.logoDataUrl,150,50);
  let first=true;
  for(const paragraph of quotationText(revision)) {
    const title=first,section=title||["BOQ","Payment schedule"].includes(paragraph)||paragraph.startsWith("GRAND TOTAL:"),fontSize=title?theme.titleSize:size;
    if(title){page.drawLine({start:{x:margin,y:y+18},end:{x:pageWidth-margin,y:y+18},color:accent,thickness:theme.ruleWidth});first=false;}
    for(const line of layout.lines(paragraph,fontSize,pageWidth-2*margin)) {
      if(y<margin+lineHeight){page=pdf.addPage([pageWidth,pageHeight]);y=pageHeight-margin;}
      let x=margin;
      for(const run of layout.runs(line)) {
        page.drawText(run.text,{x,y,size:fontSize,font:run.font,...(section?{color:accent}:{})});
        x+=run.font.widthOfTextAtSize(run.text,fontSize);
      }
      y-=lineHeight;
    }
  }
  if(revision.printAssets?.signatureDataUrl)await drawImage(revision.printAssets.signatureDataUrl,160,60);
  if(revision.printAssets?.authorizedSignatory){
    for(const line of layout.lines(`Authorized signatory: ${revision.printAssets.authorizedSignatory}`,size,pageWidth-2*margin)){
      if(y<margin+lineHeight){page=pdf.addPage([pageWidth,pageHeight]);y=pageHeight-margin;}
      let x=margin;for(const run of layout.runs(line)){page.drawText(run.text,{x,y,size,font:run.font});x+=run.font.widthOfTextAtSize(run.text,size);}y-=lineHeight;
    }
  }
  return Buffer.from(await pdf.save({useObjectStreams:false}));
}
