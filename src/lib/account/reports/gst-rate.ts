import {Prisma,type ExpenseTransaction} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {requireAccountModules} from "../modules";
import {economicDocumentsAt} from "../commercial-report-policy";
import {postedJournalAt} from "../settlement-policy";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
const components=["CGST","SGST","IGST","CESS"] as const;
type Amounts={cgst:Prisma.Decimal;sgst:Prisma.Decimal;igst:Prisma.Decimal;cess:Prisma.Decimal};
/** Tax In/Out follow the supplied activity report: sales collected / purchase-expense paid.
 * Stored components are authoritative; this is not an input-credit eligibility calculation. */
export async function gstRateReport(c:FinancialReportContext):Promise<ReportResult>{
 if(!c.actor.companyId)throw new AuthorizationError();
 await requireAccountModules(c.actor,"GST_ADVANCED");
 return db.$transaction(async tx=>{
  const groups=new Map<string,{name:string;rate:string;incoming:Prisma.Decimal;outgoing:Prisma.Decimal}>();
  function add(values:Amounts,taxRate:Prisma.Decimal|null,cessRate:Prisma.Decimal|null,incoming:boolean,sign:number){
   components.forEach((component,index)=>{
    const amount=values[component.toLowerCase() as keyof Amounts].mul(sign);if(amount.isZero())return;
    const rate=(component==="CESS"?cessRate:taxRate)?.div(index<2?2:1),rateText=rate?.toString()??"",key=JSON.stringify([component,rateText]);
    const row=groups.get(key)??{name:rate?`${component}@${rateText}%`:`${component} (document adjustment)`,rate:rate?`${rateText}%`:"",incoming:new D(0),outgoing:new D(0)};
    if(incoming)row.incoming=row.incoming.add(amount);else row.outgoing=row.outgoing.add(amount);groups.set(key,row);
   });
  }
  let cursor:string|undefined;
  for(;;){
   const docs=await tx.commercialDocument.findMany({where:{companyId:c.actor.companyId,...c.branch,...economicDocumentsAt(c.to),issueDate:{gte:c.from,lte:c.to},type:{in:["SALES_INVOICE","CREDIT_NOTE","PURCHASE_BILL","DEBIT_NOTE"]}},select:{id:true,type:true,cgstTotal:true,sgstTotal:true,igstTotal:true,cessTotal:true,lines:{select:{taxRate:true,cessRate:true,cgstAmount:true,sgstAmount:true,igstAmount:true,cessAmount:true}}},orderBy:[{issueDate:"asc"},{createdAt:"asc"},{id:"asc"}],take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   for(const doc of docs){
    const incoming=doc.type==="SALES_INVOICE"||doc.type==="CREDIT_NOTE",sign=doc.type==="CREDIT_NOTE"||doc.type==="DEBIT_NOTE"?-1:1;
    const remainder:Amounts={cgst:new D(doc.cgstTotal),sgst:new D(doc.sgstTotal),igst:new D(doc.igstTotal),cess:new D(doc.cessTotal)};
    for(const line of doc.lines){const values={cgst:line.cgstAmount,sgst:line.sgstAmount,igst:line.igstAmount,cess:line.cessAmount};add(values,new D(line.taxRate),new D(line.cessRate),incoming,sign);for(const key of Object.keys(remainder) as Array<keyof Amounts>)remainder[key]=remainder[key].sub(values[key]);}
    add(remainder,null,null,incoming,sign);
   }
   if(docs.length<1000)break;cursor=docs[docs.length-1].id;
  }
  cursor=undefined;
  for(;;){
   const expenses:Array<Pick<ExpenseTransaction,"id"|"journalEntryId"|"taxRate"|"cessRate"|"cgstAmount"|"sgstAmount"|"igstAmount"|"cessAmount">>=await tx.expenseTransaction.findMany({where:{companyId:c.actor.companyId,...c.branch,status:{in:["POSTED","REVERSED"]},type:{not:"OTHER_INCOME"},journalEntryId:{not:null},transactionDate:{gte:c.from,lte:c.to}},select:{id:true,journalEntryId:true,taxRate:true,cessRate:true,cgstAmount:true,sgstAmount:true,igstAmount:true,cessAmount:true},orderBy:[{transactionDate:"asc"},{createdAt:"asc"},{id:"asc"}],take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   if(!expenses.length)break;
   const journals=await tx.journalEntry.findMany({where:{companyId:c.actor.companyId,...c.branch,...postedJournalAt(c.to),id:{in:expenses.flatMap(row=>row.journalEntryId?[row.journalEntryId]:[])}},select:{id:true}}),eligible=new Set(journals.map(row=>row.id));
   for(const row of expenses)if(row.journalEntryId&&eligible.has(row.journalEntryId))add({cgst:row.cgstAmount,sgst:row.sgstAmount,igst:row.igstAmount,cess:row.cessAmount},new D(row.taxRate),new D(row.cessRate),false,1);
   if(expenses.length<1000)break;cursor=expenses[expenses.length-1].id;
  }
  const rows=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)),incoming=rows.reduce((sum,row)=>sum.add(row.incoming),new D(0)),outgoing=rows.reduce((sum,row)=>sum.add(row.outgoing),new D(0));
  return{title:"GST Rate Report",columns:["Tax Rate","Tax Percent","Tax In","Tax Out"],rows:rows.map(row=>[row.name,row.rate,row.incoming.toFixed(2),row.outgoing.toFixed(2)]),totals:["Total","",incoming.toFixed(2),outgoing.toFixed(2)],summary:[{label:"Total Tax In",value:incoming.toFixed(2),money:true},{label:"Total Tax Out",value:outgoing.toFixed(2),money:true}],note:"Tax In is stored GST/cess on sales; Tax Out is stored GST/cess on purchases and posted expenses. Credit/debit notes reduce their respective side. Independent component rounding is retained. Unknown historical component rates appear as document adjustments rather than invented percentages. Other income, drafts, TDS and TCS are excluded. Expense tax is gross recorded tax, not eligible input tax credit. Authorized company/branches and selected period only; no ledger changes."};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
