import "regenerator-runtime/runtime";
import type { CustomerQuotationDto } from "./service";
import { PDFDocument, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
const address=(party:{addressLine1?:string|null;addressLine2?:string|null;locality?:string|null;city?:string|null;state?:string|null;postalCode?:string|null;country?:string|null})=>[party.addressLine1,party.addressLine2,party.locality,party.city,party.state,party.postalCode,party.country].filter(Boolean).join(", ");

function quotationText(revision:CustomerQuotationDto):string[] {
 const {document}=revision,company=document.company,branch=document.branch;
 return [`${document.documentType} ${document.documentNumber} / Revision ${revision.revisionNumber}`,company.name,address(company),[company.primaryPhone,company.contactEmail,company.website].filter(Boolean).join(" | "),`Company GSTIN: ${company.gstin??"-"} | PAN: ${company.pan??"-"} | Registration: ${company.registrationNumber??"-"}`,`Branch: ${branch.name} (${branch.code})`,address(branch),[branch.phone,branch.email,branch.gstin?`GSTIN ${branch.gstin}`:null].filter(Boolean).join(" | "),`Issue: ${revision.issueDate.toISOString().slice(0,10)}${revision.validUntil?` | Valid until: ${revision.validUntil.toISOString().slice(0,10)}`:""}`,`Customer/Lead: ${revision.customerName}`,`Contact: ${revision.contactPerson??"-"} | ${revision.phone??"-"} | ${revision.email??"-"}`,`Billing: ${revision.billingAddress??"-"}`,`Site: ${revision.siteAddress??"-"}`,`Customer GSTIN: ${revision.gstin??"-"} | PAN: ${revision.pan??"-"}`,...(revision.customFields??[]).map(field=>`${field.label}: ${field.value}`),"BOQ",...revision.lines.flatMap((line,index)=>[`${index+1}. ${line.itemName}${line.itemCode?` (${line.itemCode})`:""} [${line.unitSymbol??line.unitName??""}]`,`${line.description??""} ${line.specification??""}`,`Qty ${line.quantity} x Rate ${line.rate} = ${line.baseAmount} | Discount ${line.discountAmount} | Taxable ${line.taxableAmount} | GST ${line.taxRate}%: ${line.taxAmount} | Total ${line.lineTotal}`]),`Subtotal: ${revision.subtotal}`,`Discount total: ${revision.discountTotal}`,...revision.adjustments.map(item=>`${item.type==="DISCOUNT"?"Discount":"Additional charge"} - ${item.label}: ${item.amount}${item.taxable?` + tax ${item.taxAmount}`:""}`),`Additional charges: ${revision.additionalChargeTotal}`,`Taxable: ${revision.taxableTotal} | GST/Tax: ${revision.taxTotal}`,`GRAND TOTAL: ${revision.grandTotal}`,"Payment schedule",...revision.paymentSchedule.map(row=>`${row.label}: ${row.amount} ${row.dueDescription??""}`),`Terms: ${revision.terms??""}`,`Inclusions: ${revision.inclusions??""}`,`Exclusions: ${revision.exclusions??""}`,`Notes: ${revision.notes??""}`].filter(Boolean);
}

const fontFiles = ["NotoSans-Regular.ttf", "NotoSansDevanagari-Regular.ttf", "NotoSansKannada-Regular.ttf"];
let fontBytes:Promise<Buffer[]>|undefined;
const fontData=()=>fontBytes??=Promise.all(fontFiles.map(file=>readFile(join(process.cwd(),"assets/fonts",file)))).catch(error=>{fontBytes=undefined;throw error;});
type FontChoice={font:PDFFont;characters:Set<number>};
const segmenter=new Intl.Segmenter("en",{granularity:"grapheme"});
function runs(text:string,fonts:FontChoice[]) {
  const result:Array<{text:string;font:PDFFont}>=[];
  for(const {segment} of segmenter.segment(text)) {
    const points=Array.from(segment).map(char=>char.codePointAt(0)!);
    const choice=fonts.find(font=>points.every(point=>font.characters.has(point)||point===0x200c||point===0x200d));
    if(!choice)throw new Error("QUOTATION_PDF_UNSUPPORTED_CHARACTER");
    const last=result[result.length-1];
    if(last?.font===choice.font)last.text+=segment;
    else result.push({text:segment,font:choice.font});
  }
  return result;
}
const widthCaches=new WeakMap<FontChoice[],Map<string,number>>();
function width(text:string,fonts:FontChoice[],size:number) {
  let cache=widthCaches.get(fonts);
  if(!cache){cache=new Map();widthCaches.set(fonts,cache);}
  const key=`${size}:${text}`,cached=cache.get(key);
  if(cached!==undefined)return cached;
  const measured=runs(text,fonts).reduce((total,run)=>total+run.font.widthOfTextAtSize(run.text,size),0);
  cache.set(key,measured);
  return measured;
}
function wrappedLines(text:string,fonts:FontChoice[],size:number,maxWidth:number) {
  const result:string[]=[];
  for(const paragraph of text.replace(/\r\n?/g,"\n").split("\n")) {
    let line="";
    for(const word of paragraph.replace(/[\t\f\v]/g," ").split(/( +)/u)) {
      if(!word)continue;
      if(width(line+word,fonts,size)<=maxWidth){line+=word;continue;}
      if(line.trim()){result.push(line.trimEnd());line="";}
      const token=word.trimStart();
      if(width(token,fonts,size)<=maxWidth){line=token;continue;}
      for(const {segment} of segmenter.segment(token)) {
        if(line&&width(line+segment,fonts,size)>maxWidth){result.push(line);line="";}
        line+=segment;
      }
    }
    result.push(line.trimEnd());
  }
  return result;
}
/** Only explicit customer DTO fields enter the PDF. Fonts and measured wrapping
 * retain Unicode text; no source IDs, internal costs or margins are serialized. */
export async function renderQuotationPdf(revision:CustomerQuotationDto) {
  const pdf=await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts=await Promise.all((await fontData()).map(async bytes=>{
    const font=await pdf.embedFont(bytes,{subset:true});
    return {font,characters:new Set(font.getCharacterSet())};
  }));
  pdf.setTitle(`${revision.document.documentNumber} / Revision ${revision.revisionNumber}`);
  const pageWidth=595,pageHeight=842,margin=40,size=9,lineHeight=16;
  let page=pdf.addPage([pageWidth,pageHeight]),y=pageHeight-margin;
  for(const paragraph of quotationText(revision)) {
    for(const line of wrappedLines(paragraph,fonts,size,pageWidth-2*margin)) {
      if(y<margin+lineHeight){page=pdf.addPage([pageWidth,pageHeight]);y=pageHeight-margin;}
      let x=margin;
      for(const run of runs(line,fonts)) {
        page.drawText(run.text,{x,y,size,font:run.font});
        x+=run.font.widthOfTextAtSize(run.text,size);
      }
      y-=lineHeight;
    }
  }
  return Buffer.from(await pdf.save({useObjectStreams:false}));
}
