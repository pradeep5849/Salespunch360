import { PDFDocument, StandardFonts } from "pdf-lib";
import {createPdfTextLayout} from "@/lib/pdf/text-layout";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
const D=Prisma.Decimal.clone({precision:48}),Z=new D(0),sum=(xs:Prisma.Decimal[])=>xs.reduce((a,b)=>a.add(b),Z);
export const REPORT_EXPORT_LIMIT=10_000;
export type ReportLine={ledgerId:string;code:string;name:string;accountClass:"ASSET"|"LIABILITY"|"EQUITY"|"INCOME"|"EXPENSE";openingDebit:Prisma.Decimal;openingCredit:Prisma.Decimal;periodDebit:Prisma.Decimal;periodCredit:Prisma.Decimal};
export function trialBalance(lines:ReportLine[]){const rows=lines.map(l=>{const opening=new D(l.openingDebit).sub(l.openingCredit),period=new D(l.periodDebit).sub(l.periodCredit),closing=opening.add(period);return {...l,closingDebit:Prisma.Decimal.max(Z,closing),closingCredit:Prisma.Decimal.max(Z,closing.neg())};});return {rows,totals:{openingDebit:sum(rows.map(r=>r.openingDebit)),openingCredit:sum(rows.map(r=>r.openingCredit)),periodDebit:sum(rows.map(r=>r.periodDebit)),periodCredit:sum(rows.map(r=>r.periodCredit)),closingDebit:sum(rows.map(r=>r.closingDebit)),closingCredit:sum(rows.map(r=>r.closingCredit))}};}
export function profitAndLoss(lines:ReportLine[]){const income=sum(lines.filter(l=>l.accountClass==="INCOME").map(l=>new D(l.periodCredit).sub(l.periodDebit))),expenses=sum(lines.filter(l=>l.accountClass==="EXPENSE").map(l=>new D(l.periodDebit).sub(l.periodCredit)));return {income,expenses,profit:income.sub(expenses)};}
export function balanceSheet(lines:ReportLine[]){const balance=(classes:ReportLine["accountClass"][])=>sum(lines.filter(l=>classes.includes(l.accountClass)).map(l=>new D(l.openingDebit).add(l.periodDebit).sub(l.openingCredit).sub(l.periodCredit))),assets=balance(["ASSET"]),liabilities=balance(["LIABILITY"]).neg(),equity=balance(["EQUITY"]).neg(),currentEarnings=balance(["INCOME","EXPENSE"]).neg();return {assets,liabilities,equity,currentEarnings,liabilitiesAndEquity:liabilities.add(equity).add(currentEarnings),difference:assets.sub(liabilities).sub(equity).sub(currentEarnings)};}
export function runningLedger<T extends {debit:Prisma.Decimal;credit:Prisma.Decimal}>(opening:Prisma.Decimal,rows:T[]){let balance=new D(opening);return rows.map(row=>({...row,runningBalance:(balance=balance.add(row.debit).sub(row.credit))}));}
export type AgingDocument={id:string;partyId:string;dueDate:Date|null;issueDate:Date;outstanding:Prisma.Decimal};
export function aging(rows:AgingDocument[],asOf:Date){const buckets={current:Z,"1_30":Z,"31_60":Z,"61_90":Z,"90_plus":Z};for(const row of rows.filter(r=>r.outstanding.gt(0))){const days=Math.max(0,Math.floor((asOf.getTime()-(row.dueDate??row.issueDate).getTime())/86400000));const key=days===0?"current":days<=30?"1_30":days<=60?"31_60":days<=90?"61_90":"90_plus";buckets[key]=buckets[key].add(row.outstanding);}return buckets;}
export function cashFlow(rows:Array<{sourceType:string;amount:Prisma.Decimal;direction:"IN"|"OUT"}>){const result={operating:Z,investing:Z,financing:Z,net:Z};for(const row of rows){if(row.sourceType==="MONEY_TRANSFER")continue;const signed=row.direction==="IN"?row.amount:row.amount.neg(),key=/ASSET/.test(row.sourceType)?"investing":/LOAN|CAPITAL|DRAWING/.test(row.sourceType)?"financing":"operating";result[key]=result[key].add(signed);result.net=result.net.add(signed);}return result;}
const csvCell=(v:unknown)=>{const s=String(v??"");return /[",\n\r]/.test(s)?`"${s.replaceAll('"','""')}"`:s;};
export function exportCsv(columns:string[],rows:unknown[][]){if(rows.length>REPORT_EXPORT_LIMIT)throw new Error("REPORT_EXPORT_LIMIT_EXCEEDED");return `\uFEFF${[columns,...rows].map(r=>r.map(csvCell).join(",")).join("\r\n")}`;}
export async function exportExcel(input:{title:string;company:string;filter:string;columns:string[];rows:unknown[][]}){if(input.rows.length>REPORT_EXPORT_LIMIT)throw new Error("REPORT_EXPORT_LIMIT_EXCEEDED");const book=new ExcelJS.Workbook(),sheet=book.addWorksheet("Report");sheet.addRow([input.title]);sheet.addRow([input.company]);sheet.addRow([input.filter]);sheet.addRow([`Generated: ${new Date().toISOString()}`]);sheet.addRow([]);sheet.addRow(input.columns);input.rows.forEach(row=>sheet.addRow(row));sheet.getRow(1).font={bold:true,size:16};sheet.getRow(6).font={bold:true};sheet.columns.forEach(c=>{c.width=18});return Buffer.from(await book.xlsx.writeBuffer());}
export async function exportPdf(input:{title:string;company:string;filter?:string;columns:string[];rows:unknown[][]}) {
 if(input.rows.length>REPORT_EXPORT_LIMIT)throw new Error("REPORT_EXPORT_LIMIT_EXCEEDED");
 const paragraphs=[input.title,input.company,...(input.filter?[input.filter]:[]),input.columns.join(" | "),...input.rows.map(row=>row.map(value=>String(value??"")).join(" | "))];
 const pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const layout=await createPdfTextLayout(pdf,"REPORT_PDF_UNSUPPORTED_CHARACTER",{regular,bold},paragraphs.some(text=>/[^\x20-\x7e\n\r\t]/u.test(text)));
 pdf.setTitle(input.title);
 const width=595,height=842,margin=36,size=8,lineHeight=14;
 let page=pdf.addPage([width,height]),y=height-margin;
 for(const paragraph of paragraphs)for(const line of layout.lines(paragraph,size,width-2*margin)){
  if(y<margin+lineHeight){page=pdf.addPage([width,height]);y=height-margin;}
  let x=margin;
  for(const run of layout.runs(line)){page.drawText(run.text,{x,y,size,font:run.font});x+=run.font.widthOfTextAtSize(run.text,size);}
  y-=lineHeight;
 }
 return Buffer.from(await pdf.save({useObjectStreams:false}));
}
