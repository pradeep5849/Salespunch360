import {gstStateName} from "@/lib/account/gst-states";
import {PDFDocument,rgb,type PDFPage} from "pdf-lib";
import {Prisma} from "@prisma/client";
import {createPdfTextLayout} from "@/lib/pdf/text-layout";
import {formatMoney,formatCalendarDate,resolveDisplayPreferences} from "@/lib/account/display-preferences";
import {printableAmountWords} from "@/lib/account/print-renderer";
import {quotationPdfTheme} from "./print-presentation";
import type {CustomerQuotationDto} from "./service";
/** Render only the customer-safe snapshot; styling cannot recalculate or post money. */
export async function renderThemedQuotationPdf(revision:CustomerQuotationDto){
 const style=quotationPdfTheme(revision.printPresentation),selected=style.profile;if(!selected)throw new Error("QUOTATION_THEME_INVALID");const profile=selected;
 const pdf=await PDFDocument.create(),layout=await createPdfTextLayout(pdf,"QUOTATION_PDF_UNSUPPORTED_CHARACTER");
 const landscape=profile.id.startsWith("LANDSCAPE"),W=landscape?842:595,H=landscape?595:842,M=28,width=W-2*M;
 const accent=profile.id==="TALLY"?rgb(.2,.2,.2):rgb(...[1,3,5].map(i=>parseInt(style.color.slice(i,i+2),16)/255) as [number,number,number]),black=rgb(.12,.14,.16),white=rgb(1,1,1),rule=rgb(.65,.65,.65);
 const prefs=resolveDisplayPreferences(revision.displayPreferences),money=(v:{toString():string}|number)=>formatMoney(v,prefs),date=(v:Date)=>formatCalendarDate(v,prefs);
 pdf.setTitle(`${revision.document.documentNumber} / Revision ${revision.revisionNumber}`);pdf.setSubject(profile.name);
 let page:PDFPage=pdf.addPage([W,H]),y=H-M;
 const tableHeader:{values:string[];weights:number[]}={values:[],weights:[]};let tableActive=false;
 const next=(repeatHeader=true)=>{page=pdf.addPage([W,H]);y=H-M;if(repeatHeader&&tableActive&&tableHeader)cells(tableHeader.values,tableHeader.weights,true)};
 const text=(s:string,x:number,top:number,size=8,color=black)=>{let px=x;for(const run of layout.runs(s)){page.drawText(run.text,{x:px,y:top-size,size,font:run.font,color});px+=run.font.widthOfTextAtSize(run.text,size)}};
 function paragraph(s:string,size=8,color=black){for(const line of layout.lines(s,size,width)){if(y<M+size+5)next();text(line,M,y,size,color);y-=size+5}}
 function cells(values:string[],weights:number[],header=false,minHeight=0){
  const total=weights.reduce((a,b)=>a+b,0),sizes=weights.map(w=>width*w/total),lines=values.map((v,i)=>layout.lines(v,7,sizes[i]-8));
  let offset=0;const count=Math.max(1,...lines.map(l=>l.length)),lineHeight=11;
  while(offset<count){
   if(y<M+24)next(!header);const capacity=Math.max(1,Math.floor((y-M-8)/lineHeight)),take=Math.min(count-offset,capacity),height=Math.max(take*lineHeight+8,offset===0?minHeight:0);
   if(y-height<M){next(!header);continue}let x=M;
   sizes.forEach((w,i)=>{page.drawRectangle({x,y:y-height,width:w,height,...(header?{color:profile.id==="TALLY"?rgb(.93,.93,.93):accent}:{}),borderColor:rule,borderWidth:profile.grid||header?0.4:0});for(let j=0;j<take;j++){const line=lines[i][offset+j];if(line!==undefined)text(line,x+4,y-4-j*lineHeight,7,header&&profile.id!=="TALLY"?white:black)}x+=w});y-=height;offset+=take;
  }
 }
 async function image(url:string,x:number,top:number,maxWidth:number,maxHeight:number){if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(url))throw new Error("QUOTATION_PRINT_ASSET_INVALID");const img=await pdf.embedPng(Buffer.from(url.split(',')[1],'base64'));const scale=Math.min(maxWidth/img.width,maxHeight/img.height,1);page.drawImage(img,{x,y:top-img.height*scale,width:img.width*scale,height:img.height*scale})}
 const c=revision.document.company,title=revision.document.documentType.replaceAll('_',' '),company=[c.name,[c.addressLine1,c.addressLine2,c.locality,c.city,c.state,c.postalCode,c.country].filter(Boolean).join(', '),[c.primaryPhone,c.contactEmail,c.website].filter(Boolean).join(' | '),`GSTIN: ${c.gstin??'Not recorded'}`].join('\n');
 if(profile.header==="dual"||profile.header==="banner"){page.drawRectangle({x:M,y:y-54,width,height:54,color:profile.header==="dual"?black:accent});if(profile.header==="dual")page.drawRectangle({x:M+width*.55,y:y-54,width:width*.45,height:54,color:accent});for(const [i,line]of layout.lines(c.name,12,width-90).entries())text(line,M+8,y-8-i*15,12,white);y-=64;}
 if(profile.header==="french"){page.drawRectangle({x:M,y:y-28,width:width/2,height:28,color:accent});text(title,M+6,y-6,12,white);y-=36;}
 const logo=revision.printAssets?.logoDataUrl;
 if(logo&&profile.header!=="split"){await image(logo,profile.header==="left"||profile.header==="french"?W-M-70:M,y,65,38);}
 const companyX=profile.header==="left"||profile.header==="french"?M:logo?M+80:M;
 if(profile.header!=="split")for(const line of layout.lines(company,8,width-(logo?85:0))){if(y<M+20)next();const measured=layout.runs(line).reduce((sum,run)=>sum+run.font.widthOfTextAtSize(run.text,8),0);text(line,profile.header==="right"?W-M-measured:companyX,y,8);y-=12;}y-=8;
 if(profile.header!=="french")paragraph(`${title} · ${revision.document.documentNumber} · Revision ${revision.revisionNumber}`,12,profile.id==="SIMPLE_2"?black:accent);
 const party=`Bill to\n${revision.billingName||revision.customerName}\n${revision.billingAddress??''}\n${[revision.phone,revision.email,revision.gstin].filter(Boolean).join(' | ')}`;
 const details=`Document details\n${revision.document.documentNumber}\nDate: ${date(revision.issueDate)}${revision.validUntil?`\nValid until: ${date(revision.validUntil)}`:''}\nState of supply: ${gstStateName(revision.stateOfSupplyCode)||"Not recorded"}\nRates: ${revision.taxMode==="INCLUSIVE"?'include':'exclude'} tax`;
 const site=`Site / delivery address\n${revision.siteAddress??'Not recorded'}`;
 if(profile.header==="split"){if(logo)await image(logo,M+4,y-4,65,38);cells([`${logo?"\n\n\n\n":""}${company}`,details],[1,1]);}
 if(profile.header==="split")cells([party,site],[1,1]);else cells(profile.header==="french"?[details,party,site]:[party,site,details],[1,1,1]);y-=8;
 const simple=profile.id.startsWith("SIMPLE"),headers=simple?["#","Item / Code","Quantity","Price / unit","Amount"]:profile.taxable?["#","Item / Code","Quantity","Price / unit","Discount","Taxable","GST/Tax","Amount"]:["#","Item / Code","Quantity","Price / unit","Discount","GST/Tax","Amount"];
 const weights=simple?[.4,3,1,1.4,1.5]:profile.taxable?[.4,2.5,.9,1.3,1.2,1.3,1.2,1.5]:[.4,3,.9,1.4,1.3,1.3,1.5];
 tableHeader.values=headers;tableHeader.weights=weights;tableActive=true;cells(headers,weights,true);
 for(const [i,l]of revision.lines.entries()){
  const item=[l.itemName,l.itemCode,l.description,l.specification].filter(Boolean).join('\n'),qty=`${l.quantity} ${l.unitSymbol??l.unitName??''}`,tax=`${money(l.taxAmount)} (${l.taxRate}%)`;
  const values=simple?[String(i+1),item,qty,money(l.rate),money(l.lineTotal)]:profile.taxable?[String(i+1),item,qty,money(l.rate),money(l.discountAmount),money(l.taxableAmount),tax,money(l.lineTotal)]:[String(i+1),item,qty,money(l.rate),money(l.discountAmount),tax,money(l.lineTotal)];cells(values,weights,false,25);
 }
 tableActive=false;
 if(profile.expanded&&y>H*.53){const bottom=H*.53;page.drawRectangle({x:M,y:bottom,width,height:y-bottom,borderColor:rule,borderWidth:.4});let columnX=M;const weightTotal=weights.reduce((sum,value)=>sum+value,0);for(const weight of weights.slice(0,-1)){columnX+=width*weight/weightTotal;page.drawLine({start:{x:columnX,y},end:{x:columnX,y:bottom},color:rule,thickness:.4});}y=bottom;}
 cells(["Recorded total",money(revision.grandTotal)],[3,1],true);y-=8;
 const words=printableAmountWords(revision.grandTotal.toString(),prefs.baseCurrency,revision.printPresentation?.amountWordsFormat);
 const D=Prisma.Decimal.clone({precision:48}),taxes=new Map<string,Prisma.Decimal>();
 // Additional-charge tax is part of the retained total. Discounts already reduce saved line tax.
 // Group recorded amounts only; never recalculate historical tax or infer a CGST/SGST jurisdiction.
 const recordedTaxRows=[...revision.lines,...revision.adjustments.filter(row=>!new D(row.taxAmount.toString()).isZero())];
 for(const row of recordedTaxRows){const rate=new D(row.taxRate.toString()).toString();taxes.set(rate,(taxes.get(rate)??new D(0)).add(row.taxAmount.toString()))}
 const taxSummary=[...taxes].map(([rate,value])=>`${rate}%: ${money(value)}`).join('\n');
 const amounts=`Amounts\nSubtotal: ${money(revision.subtotal)}\nDiscount: ${money(revision.discountTotal)}\nAdditional charges: ${money(revision.additionalChargeTotal)}\nTaxable: ${money(revision.taxableTotal)}\nGST/Tax: ${money(revision.taxTotal)}\nRound off: ${money(revision.roundOffAmount??0)}\nTotal: ${money(revision.grandTotal)}`;
 cells(profile.id==="GST_5"||profile.id==="LANDSCAPE_1"?[`Tax summary\n${taxSummary}`,amounts]:[`Amount in words\n${words}`,amounts],[1,1]);
 if(profile.id==="GST_5"||profile.id==="LANDSCAPE_1")paragraph(`Amount in words: ${words}`);else paragraph(`Tax summary (recorded line and adjustment tax): ${taxSummary}`);
 for(const a of revision.adjustments)paragraph(`${a.type==='DISCOUNT'?'Discount':'Additional charge'} — ${a.label}: ${money(a.amount)}${a.taxable?` + tax ${money(a.taxAmount)}`:''}`);
 for(const field of revision.customFields??[])paragraph(`${field.label}: ${field.value}`);
 for(const row of revision.paymentSchedule)paragraph(`Payment schedule — ${row.label}: ${money(row.amount)} ${row.dueDescription??''}`);
 for(const [label,value]of [["Description",revision.notes],["Terms and conditions",revision.terms],["Inclusions",revision.inclusions],["Exclusions",revision.exclusions]])if(value)paragraph(`${label}: ${value}`);
 if(revision.printAssets?.signatureDataUrl){if(y<M+75)next();await image(revision.printAssets.signatureDataUrl,W-M-160,y,150,55);y-=60;}
 if(revision.printAssets?.authorizedSignatory)paragraph(`Authorized signatory: ${revision.printAssets.authorizedSignatory}`);
 if(profile.ack){y-=10;if(profile.header==="french"||profile.header==="dual")cells(["Acknowledgement",c.name],[1,1],true);else paragraph("Acknowledgement",11,accent);cells([`${c.name}\n${revision.customerName}\n${revision.billingAddress??''}`,`${revision.document.documentNumber}\nDate: ${date(revision.issueDate)}\nAmount: ${money(revision.grandTotal)}`,"Receiver's seal and signature"],[1,1,1]);}
 paragraph("Estimate/quotation only. Amounts and tax are shown as recorded; no payment or posting is created.",7);
 if(profile.header==="dual")for(const sheet of pdf.getPages()){sheet.drawRectangle({x:M,y:12,width:width*.6,height:8,color:accent});sheet.drawRectangle({x:M+width*.6,y:12,width:width*.4,height:12,color:black});}
 return Buffer.from(await pdf.save({useObjectStreams:false}));
}
