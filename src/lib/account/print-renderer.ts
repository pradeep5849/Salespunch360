import {createPdfTextLayout} from "@/lib/pdf/text-layout";
import sharp from "sharp";
import {PDFDocument,StandardFonts,rgb,type PDFPage} from "pdf-lib";
import {Prisma,type PrintPaperSize} from "@prisma/client";
import type {AccountPrintDocument} from "./print";

const escape=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const yes=(doc:AccountPrintDocument,key:string,fallback=true)=>typeof doc.printOptions?.[key]==="boolean"?doc.printOptions[key] as boolean:fallback;
const text=(doc:AccountPrintDocument,key:string,fallback="")=>typeof doc.printOptions?.[key]==="string"?doc.printOptions[key] as string:fallback;
const number=(doc:AccountPrintDocument,key:string,fallback=0)=>typeof doc.printOptions?.[key]==="number"?doc.printOptions[key] as number:fallback;
const size=(value:string)=>value==="SMALL"?10:value==="LARGE"?16:13;
const color=(doc:AccountPrintDocument)=>{
 const theme=text(doc,"theme","REGULAR");return /^#[0-9a-f]{6}$/i.test(theme)?theme:({MODERN:"#0f766e",CLASSIC:"#4338ca",MINIMAL:"#374151",REGULAR:"#0b1930"}[theme.toUpperCase()]??"#0b1930");
};
const columns=(doc:AccountPrintDocument,thermal:boolean)=>{
 const known=["ITEM","QTY","RATE","TAXABLE","TAX","AMOUNT"];
 const configured=text(doc,"itemTableColumns").split(",").map(x=>x.trim().toUpperCase()).filter(x=>known.includes(x));
 return configured.length?[...new Set(configured)]:thermal?["ITEM","QTY","RATE","AMOUNT"]:known;
};
const amount=(doc:AccountPrintDocument,value:string)=>{
 const decimal=new Prisma.Decimal(value);const digits=yes(doc,"amountDecimal")?(doc.decimalPlaces??2):0;
 const rounded=decimal.toFixed(digits);
 if(!yes(doc,"amountGrouping"))return rounded;
 const [whole,fraction]=rounded.split(".");
 const grouped=new Intl.NumberFormat(text(doc,"amountWordsFormat","INDIAN")==="INTERNATIONAL"?"en-US":"en-IN").format(BigInt(whole));
 return `${whole.startsWith("-")&&BigInt(whole)===BigInt(0)?"-":""}${grouped}${fraction===undefined?"":"."+fraction}`;
};
const units=["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
function words(v:bigint,indian:boolean):string {
 if(v<BigInt(20))return units[Number(v)];
 if(v<BigInt(100))return ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"][Number(v/BigInt(10))]+(v%BigInt(10)?" "+words(v%BigInt(10),indian):"");
 const groups=indian?[["10000000","crore"],["100000","lakh"],["1000","thousand"],["100","hundred"]]:[["1000000000000000000","quintillion"],["1000000000000000","quadrillion"],["1000000000000","trillion"],["1000000000","billion"],["1000000","million"],["1000","thousand"],["100","hundred"]];
 for(const [raw,name] of groups){const factor=BigInt(raw);if(v>=factor)return words(v/factor,indian)+" "+name+(v%factor?" "+words(v%factor,indian):"");}return "";
}
export function printableAmountWords(value:string,currency="INR",format="INDIAN"){const decimal=new Prisma.Decimal(value),[whole,fraction]=decimal.abs().toDecimalPlaces(2).toFixed(2).split(".");return `${decimal.lt(0)?"minus ":""}${words(BigInt(whole),format!=="INTERNATIONAL")} ${currency}${BigInt(fraction)?" and "+words(BigInt(fraction),false)+" hundredths":""} only`;}
function amountWords(doc:AccountPrintDocument){return printableAmountWords(doc.payableAmount??doc.total,doc.currency??"INR",text(doc,"amountWordsFormat","INDIAN"));}
function cell(doc:AccountPrintDocument,row:AccountPrintDocument["lines"][number],column:string){
 return column==="ITEM"?row.description+(yes(doc,"printDescription")&&row.detail?" — "+row.detail:""):column==="QTY"?row.quantity:amount(doc,column==="RATE"?row.rate:column==="TAXABLE"?row.taxable:column==="TAX"?row.tax:row.total);
}
function totals(doc:AccountPrintDocument){
 const rows=[['Subtotal',amount(doc,doc.subtotal)]];
 if(yes(doc,"taxDetails"))for(const [label,value] of [["CGST",doc.cgst],["SGST",doc.sgst],["IGST",doc.igst],["CESS",doc.cess]])if(new Prisma.Decimal(value).gt(0))rows.push([label,amount(doc,value)]);
 rows.push(["Grand total",amount(doc,doc.total)]);
 if(doc.reverseChargeTax!==undefined){rows.push(["GST payable by recipient (reverse charge)",amount(doc,doc.reverseChargeTax)]);if(doc.payableAmount!==undefined)rows.push(["Payable amount",amount(doc,doc.payableAmount)]);}
 if(doc.paymentDiscountAmount&&new Prisma.Decimal(doc.paymentDiscountAmount).gt(0))rows.push(["Payment discount",amount(doc,doc.paymentDiscountAmount)]);
 if(yes(doc,"receivedAmount")&&doc.receivedAmount!==undefined)rows.push(["Received",amount(doc,doc.receivedAmount)]);
 if(yes(doc,"balanceAmount")&&doc.balanceAmount!==undefined)rows.push(["Balance due",amount(doc,doc.balanceAmount)]);
 if(yes(doc,"partyCurrentBalance",false)&&doc.partyCurrentBalance!==undefined)rows.push(["Party current balance",amount(doc,doc.partyCurrentBalance)]);
 if(yes(doc,"youSaved")&&doc.discountAmount&&new Prisma.Decimal(doc.discountAmount).gt(0))rows.push(["You saved",amount(doc,doc.discountAmount)]);
 if(yes(doc,"totalItemQuantity")){
  const grouped=new Map<string,Prisma.Decimal>();for(const line of doc.lines){const unit=line.unit??"";grouped.set(unit,(grouped.get(unit)??new Prisma.Decimal(0)).add(line.quantity));}
  rows.push(["Total quantity",[...grouped].map(([unit,value])=>`${value.toString()} ${unit}`.trim()).join(", ")]);
 }
 return rows;
}
function geometry(doc:AccountPrintDocument,paper:PrintPaperSize){
 const p=text(doc,"pageSize",paper);const thermal=p==="THERMAL_80MM"||text(doc,"printer")==="THERMAL";
 let dimensions: [number,number]=thermal?[227,842]:p==="A5"?[420,595]:[595,842];
 if(!thermal&&text(doc,"orientation")==="LANDSCAPE")dimensions=[dimensions[1],dimensions[0]];
 return {thermal,paper:thermal?"80mm auto":p==="A5"?"A5":"A4",dimensions};
}
export function renderAccountPrintHtml(doc:AccountPrintDocument,paper:PrintPaperSize="A4"){
 const g=geometry(doc,paper),cols=columns(doc,g.thermal),orientation=text(doc,"orientation","PORTRAIT").toLowerCase(),padding=number(doc,"topSpace")*4;
 const itemRows=doc.lines.map(row=>`<tr>${cols.map(column=>`<td>${escape(cell(doc,row,column))}${column==="ITEM"&&row.hsn?`<small><br>HSN/SAC ${escape(row.hsn)}</small>`:""}</td>`).join("")}</tr>`).join("");
 const blankRows=Array.from({length:Math.max(0,number(doc,"minRows")-doc.lines.length)},()=>`<tr>${cols.map(()=>"<td>&nbsp;</td>").join("")}</tr>`).join("");
 return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(doc.title)} ${escape(doc.number)}</title><style>@page{size:${g.paper}${g.thermal?"":" "+orientation};margin:${g.thermal?"4mm":"14mm"}}body{font:${size(text(doc,"printTextSize","MEDIUM"))}px Arial;color:#172033;max-width:${g.thermal?"72mm":"100%"};margin:auto;padding-top:${padding}px}header{border-bottom:2px solid ${color(doc)};padding-bottom:12px}h1{color:${color(doc)};font-size:24px}.company{font-size:${size(text(doc,"companyNameTextSize","LARGE"))+4}px}table{width:100%;border-collapse:collapse;margin:16px 0}thead{display:${yes(doc,"repeatHeader")?"table-header-group":"table-row-group"}}th,td{padding:6px;border-bottom:1px solid #ddd;text-align:right}th:first-child,td:first-child{text-align:left}.totals{margin-left:auto;width:min(100%,320px)}.totals div{display:flex;justify-content:space-between;gap:12px;padding:4px}.terms{white-space:pre-wrap}.items{${yes(doc,"expandTable")?"min-height:35vh":""}}@media print{${yes(doc,"pageNumbers",false)?"@page{@bottom-right{content:counter(page)}}":""}}</style></head><body><header>${doc.logoDataUrl?`<img width="150" height="54" alt="Company logo" src="${escape(doc.logoDataUrl)}">`:""}<strong class="company">${escape(doc.company)}</strong>${doc.companyAddress?`<div>${escape(doc.companyAddress)}</div>`:""}<div>${escape(doc.branch)}</div>${doc.companyGstin?`<div>GSTIN ${escape(doc.companyGstin)}</div>`:""}<div>${escape([doc.companyPhone,doc.companyEmail].filter(Boolean).join(" · "))}</div><h1>${escape(doc.title)}</h1><div>${escape(doc.number)} · ${escape(doc.date)}</div>${yes(doc,"originalDuplicate",false)?"<div>Original / Duplicate</div>":""}<p>${escape(doc.party)} ${doc.gstin?"· GSTIN "+escape(doc.gstin):""}</p>${doc.shippingAddress?`<p>Shipping: ${escape(doc.shippingAddress)}</p>`:""}${doc.partyFields?.map(field=>`<p>${escape(field.label)}: ${escape(field.value)}</p>`).join("")??""}</header><table class="items"><thead><tr>${cols.map(column=>`<th>${escape(column)}</th>`).join("")}</tr></thead><tbody>${itemRows}${blankRows}</tbody></table><section class="totals">${totals(doc).map(([label,value])=>`<div><span>${escape(label)}</span><b>${escape(value)}</b></div>`).join("")}</section><p>${escape(amountWords(doc))}</p>${doc.paymentMode?`<p>Payment mode: ${escape(doc.paymentMode)}</p>`:""}${doc.upiQrDataUrl?`<figure><img width="180" height="180" alt="UPI payment QR" src="${escape(doc.upiQrDataUrl)}"><figcaption>Scan to pay by UPI</figcaption></figure>`:doc.upiUri?`<p>UPI payment: ${escape(doc.upiUri)}</p>`:""}${doc.bankDetails?`<section><h2>Bank details</h2><p>${escape(doc.bankDetails)}</p></section>`:""}${doc.invoiceDescription&&yes(doc,"printDescription")?`<section><h2>Description</h2><p class="terms">${escape(doc.invoiceDescription)}</p></section>`:""}${doc.terms?`<section><h2>Terms</h2><p class="terms">${escape(doc.terms)}</p></section>`:""}${yes(doc,"receivedBy")?"<p>Received by: __________________</p>":""}${yes(doc,"deliveredBy")?"<p>Delivered by: __________________</p>":""}${doc.signatureDataUrl?`<img width="180" alt="Authorized signature" src="${escape(doc.signatureDataUrl)}">`:""}${doc.authorizedSignatory?`<p>Authorized signatory: ${escape(doc.authorizedSignatory)}</p>`:""}${yes(doc,"acknowledgement")?"<p>Acknowledgement: __________________</p>":""}</body></html>`;
}
export async function renderAccountPrintPdf(doc:AccountPrintDocument,paper:PrintPaperSize="A4"){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),g=geometry(doc,paper),[width,height]=g.dimensions,margin=g.thermal?12:36,bodySize=g.thermal?8:size(text(doc,"printTextSize","MEDIUM"))-2;
 const layout=await createPdfTextLayout(pdf,"ACCOUNT_PDF_UNSUPPORTED_CHARACTER",{regular:font,bold},/[^\x00-\x7f]/.test(JSON.stringify(doc)));
 const accent=color(doc),accentRgb=rgb(parseInt(accent.slice(1,3),16)/255,parseInt(accent.slice(3,5),16)/255,parseInt(accent.slice(5,7),16)/255);
 let page:PDFPage,y=0,renderingHeader=false;
 const draw=(value:string,fontSize=bodySize,strong=false)=>{
  for(const line of layout.lines(value,fontSize,width-margin*2,strong)){
   if(y<margin+25){if(renderingHeader){page=pdf.addPage(g.dimensions);y=height-margin;}else newPage();}
   let x=margin;for(const run of layout.runs(line,strong)){page.drawText(run.text,{x,y,size:fontSize,font:run.font,color:strong?accentRgb:rgb(.05,.10,.19)});x+=run.font.widthOfTextAtSize(run.text,fontSize);}y-=fontSize+6;
  }
 };
 const newPage=()=>{renderingHeader=true;try{page=pdf.addPage(g.dimensions);y=height-margin-number(doc,"topSpace")*4;if(pdf.getPageCount()!==1){if(yes(doc,"repeatHeader")){draw(doc.company,size(text(doc,"companyNameTextSize","LARGE"))+4,true);draw(`${doc.title} ${doc.number}`,bodySize+3,true);}return;}if(pdf.getPageCount()===1){draw(doc.company,size(text(doc,"companyNameTextSize","LARGE"))+4,true);if(doc.companyAddress)draw(doc.companyAddress);if(doc.companyGstin)draw(`GSTIN ${doc.companyGstin}`);if(doc.companyPhone||doc.companyEmail)draw([doc.companyPhone,doc.companyEmail].filter(Boolean).join(" | "));draw(`${doc.title} ${doc.number}`,bodySize+3,true);draw(`${doc.date} | ${doc.branch} | ${doc.party}`);if(doc.gstin)draw(`Party GSTIN ${doc.gstin}`);if(doc.shippingAddress)draw(`Shipping: ${doc.shippingAddress}`);for(const field of doc.partyFields??[])draw(`${field.label}: ${field.value}`);if(yes(doc,"originalDuplicate",false))draw("Original / Duplicate");}}finally{renderingHeader=false;}};
 const image=async(url:string,maxWidth:number,maxHeight:number)=>{const png=await sharp(Buffer.from(url.split(",")[1]??"","base64")).png().toBuffer(),embedded=await pdf.embedPng(png),scale=Math.min(maxWidth/embedded.width,maxHeight/embedded.height,1),h=embedded.height*scale;if(y-h<margin+25)newPage();page.drawImage(embedded,{x:margin,y:y-h,width:embedded.width*scale,height:h});y-=h+10;};
 newPage();if(doc.logoDataUrl)await image(doc.logoDataUrl,Math.min(150,width-margin*2),54);
 const cols=columns(doc,g.thermal);draw(cols.join(" | "),bodySize,true);for(const row of doc.lines){draw(cols.map(column=>cell(doc,row,column)).join(" | "));if(cols.includes("ITEM")&&row.hsn)draw(`HSN/SAC ${row.hsn}`,bodySize-1);}
 for(let i=doc.lines.length;i<number(doc,"minRows");i++)draw("____________________________");
 if(yes(doc,"expandTable"))y=Math.min(y,height*.45);
 for(const [label,value] of totals(doc))draw(`${label} ${value}`,bodySize,label==="Grand total");draw(amountWords(doc));if(doc.paymentMode)draw(`Payment mode: ${doc.paymentMode}`);if(doc.bankDetails)draw(`Bank: ${doc.bankDetails}`);if(doc.upiQrDataUrl){await image(doc.upiQrDataUrl,72,72);draw("Scan to pay by UPI");}else if(doc.upiUri)draw(`UPI payment: ${doc.upiUri}`,bodySize-1);if(doc.invoiceDescription&&yes(doc,"printDescription"))draw(`Description: ${doc.invoiceDescription}`,bodySize-1);if(doc.terms)for(const paragraph of doc.terms.split("\n"))draw(paragraph,bodySize-1);if(yes(doc,"receivedBy"))draw("Received by: __________________");if(yes(doc,"deliveredBy"))draw("Delivered by: __________________");if(doc.signatureDataUrl)await image(doc.signatureDataUrl,180,70);if(doc.authorizedSignatory)draw(`Authorized signatory: ${doc.authorizedSignatory}`);if(yes(doc,"acknowledgement"))draw("Acknowledgement: __________________");
 if(yes(doc,"pageNumbers",false)){const pages=pdf.getPages();pages.forEach((p,i)=>p.drawText(`${i+1} / ${pages.length}`,{x:width-margin-40,y:margin/2,size:8,font}));}
 return Buffer.from(await pdf.save());
}
