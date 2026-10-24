import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {requireAccountModules} from "../modules";
import {economicDocumentsAt} from "../commercial-report-policy";
import {postedJournalAt} from "../settlement-policy";
import {saleInvoiceIdentities} from "../sale-invoice-identity";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
const titles={"gstr-1":"GSTR-1 Working Report","gstr-2":"GSTR-2 Working Report","gstr-3b":"GSTR-3B Working Report","gstr-9":"GSTR-9 Working Report","form-27eq":"Form No. 27EQ Working Report"} as const;
export const TAX_WORKING_REPORTS=Object.keys(titles);
const selection={id:true,companyId:true,branchId:true,type:true,documentNumber:true,issueDate:true,partyName:true,partyGstin:true,stateOfSupplyCode:true,reverseCharge:true,taxCreditTreatment:true,taxableTotal:true,cgstTotal:true,sgstTotal:true,igstTotal:true,cessTotal:true,tcsAmount:true} as const satisfies Prisma.CommercialDocumentSelect;
type Document=Prisma.CommercialDocumentGetPayload<{select:typeof selection}>;
const expenseSelection={id:true,transactionNumber:true,transactionDate:true,type:true,journalEntryId:true,taxableAmount:true,cgstAmount:true,sgstAmount:true,igstAmount:true,cessAmount:true,stateOfSupplyCode:true,taxCreditTreatment:true} as const satisfies Prisma.ExpenseTransactionSelect;
type Expense=Prisma.ExpenseTransactionGetPayload<{select:typeof expenseSelection}>;
type RecordRow={date:Date;number:string;type:string;party:string;gstin:string|null;state:string|null;rcm:string;treatment:string;outward:boolean;values:Prisma.Decimal[];tcs:Prisma.Decimal};
/** Approved PDF/Excel working papers only. Saved tax flags/amounts are shown;
 * statutory eligibility, offsets, remittance and filing sections are not inferred. */
export async function taxWorkingReport(c:FinancialReportContext,key:string):Promise<ReportResult>{
 if(!c.actor.companyId||!["ACCOUNT_ADMIN","ACCOUNTANT"].includes(c.actor.accountRole??""))throw new AuthorizationError();
 if(!Object.hasOwn(titles,key))throw new Error("INVALID_REPORT");await requireAccountModules(c.actor,"GST_ADVANCED");
 const companyId=c.actor.companyId,form=key==="form-27eq",summary=key==="gstr-3b"||key==="gstr-9",outwardOnly=key==="gstr-1"||form,inwardOnly=key==="gstr-2";
 return db.$transaction(async tx=>{
  const rows:ReportResult["rows"]=[],totals=Array.from({length:5},()=>new D(0)),groups=new Map<string,{labels:string[];values:Prisma.Decimal[]}>();let outwardTax=new D(0),inwardTax=new D(0),tcs=new D(0),cursor:string|undefined;
  function consume(row:RecordRow){
   const tax=row.values.slice(1).reduce((sum,value)=>sum.add(value),new D(0));if(row.outward)outwardTax=outwardTax.add(tax);else inwardTax=inwardTax.add(tax);row.values.forEach((value,index)=>{totals[index]=totals[index].add(value)});tcs=tcs.add(row.tcs);
   if(form){rows.push([row.date.toISOString().slice(0,10),row.number,row.type,row.party,row.gstin??"Not recorded",row.state??"Not recorded",row.values[0].toFixed(2),row.tcs.toFixed(2)]);return}
   if(summary){const labels=[...(key==="gstr-9"?[row.date.toISOString().slice(0,7)]:[]),row.outward?"Outward":"Inward",row.type,row.rcm,row.treatment],groupKey=JSON.stringify(labels),group=groups.get(groupKey)??{labels,values:Array.from({length:5},()=>new D(0))};row.values.forEach((value,index)=>{group.values[index]=group.values[index].add(value)});groups.set(groupKey,group);return}
   rows.push([row.date.toISOString().slice(0,10),row.number,row.type,row.party,row.gstin??"Not recorded",row.state??"Not recorded",row.rcm,row.treatment,...row.values.map(value=>value.toFixed(2))]);
  }
  for(;;){
   const documents:Document[]=await tx.commercialDocument.findMany({where:{companyId,...c.branch,...economicDocumentsAt(c.to),issueDate:{gte:c.from,lte:c.to},type:{in:outwardOnly?["SALES_INVOICE","CREDIT_NOTE"]:inwardOnly?["PURCHASE_BILL","DEBIT_NOTE"]:["SALES_INVOICE","CREDIT_NOTE","PURCHASE_BILL","DEBIT_NOTE"]},...(form?{tcsAmount:{not:0}}:{})},select:selection,orderBy:[{issueDate:"asc"},{id:"asc"}],take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   const identities=await saleInvoiceIdentities(tx,companyId,documents);
   for(const doc of documents){const outward=["SALES_INVOICE","CREDIT_NOTE"].includes(doc.type),sign=["CREDIT_NOTE","DEBIT_NOTE"].includes(doc.type)?-1:1;consume({date:doc.issueDate,number:identities.get(doc.id)!.printedNumber,type:doc.type.replaceAll("_"," "),party:doc.partyName,gstin:doc.partyGstin,state:doc.stateOfSupplyCode,rcm:doc.reverseCharge?"Yes":"No",treatment:outward?"Not applicable":doc.taxCreditTreatment,outward,values:[doc.taxableTotal,doc.cgstTotal,doc.sgstTotal,doc.igstTotal,doc.cessTotal].map(value=>new D(value).mul(sign)),tcs:new D(doc.tcsAmount).mul(sign)})}
   if(documents.length<1000)break;cursor=documents[documents.length-1].id;
  }
  if(!form){cursor=undefined;for(;;){
   const expenses:Expense[]=await tx.expenseTransaction.findMany({where:{companyId,...c.branch,status:{in:["POSTED","REVERSED"]},journalEntryId:{not:null},transactionDate:{gte:c.from,lte:c.to},...(outwardOnly?{type:"OTHER_INCOME" as const}:inwardOnly?{type:{not:"OTHER_INCOME" as const}}:{})},select:expenseSelection,orderBy:[{transactionDate:"asc"},{id:"asc"}],take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   if(!expenses.length)break;
   const eligible=new Set((await tx.journalEntry.findMany({where:{companyId,...c.branch,...postedJournalAt(c.to),id:{in:expenses.flatMap(row=>row.journalEntryId?[row.journalEntryId]:[])}},select:{id:true}})).map(row=>row.id));
   for(const expense of expenses){if(!expense.journalEntryId||!eligible.has(expense.journalEntryId))continue;const outward=expense.type==="OTHER_INCOME";consume({date:expense.transactionDate,number:expense.transactionNumber,type:expense.type.replaceAll("_"," "),party:"Not recorded on expense/income",gstin:null,state:expense.stateOfSupplyCode,rcm:"Not recorded",treatment:outward?"Not applicable":expense.taxCreditTreatment,outward,values:[expense.taxableAmount,expense.cgstAmount,expense.sgstAmount,expense.igstAmount,expense.cessAmount].map(value=>new D(value)),tcs:new D(0)})}
   if(expenses.length<1000)break;cursor=expenses[expenses.length-1].id;
  }}
  if(summary)for(const [,group]of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)))rows.push([...group.labels,...group.values.map(value=>value.toFixed(2))]);
  else rows.sort((a,b)=>String(a[0]).localeCompare(String(b[0]))||String(a[1]).localeCompare(String(b[1])));
  const leading=form?["Date","Document","Transaction Type","Party","Party GSTIN","Place of Supply"]:summary?[...(key==="gstr-9"?["Month"]:[]),"Side","Transaction Type","Reverse Charge (saved)","Saved credit treatment"]:["Date","Document","Transaction Type","Party","Party GSTIN","Place of Supply","Reverse Charge (saved)","Saved credit treatment"];
  return{title:titles[key as keyof typeof titles],columns:[...leading,...(form?["Taxable","TCS"]:["Taxable","CGST","SGST","IGST","CESS"])],rows,...(!summary?{totals:["Recorded totals",...Array.from({length:leading.length-1},()=>""),...(form?[totals[0].toFixed(2),tcs.toFixed(2)]:totals.map(value=>value.toFixed(2)))]}:{}),summary:form?[{label:"Recorded TCS",value:tcs.toFixed(2),money:true}]:[{label:"Recorded Outward GST including CESS",value:outwardTax.toFixed(2),money:true},{label:"Recorded Inward GST including CESS",value:inwardTax.toFixed(2),money:true}],note:`WORKING REPORT — PDF/Excel summary of saved transactions, not a filing-ready return. Authorized company/branches and selected document/transaction dates; effective posted history at the selected end date. Original credit/debit notes retain signed billed amounts and corrected Sales retain printed invoice numbers. ${form?"Recorded TCS on sales/credit notes only. Taxable is the saved document base, not a statutory section base. No challan, remittance or deductee-section reconciliation is inferred.":"Includes commercial invoices/returns and posted standalone expenses/other income. Missing party GSTIN and expense reverse-charge information stay explicitly not recorded. Saved credit-treatment flags are displayed, not independently validated eligibility; inward tax is not a claim of available ITC. No statutory table mapping, tax offsets, net liability, carry-forward, portal reconciliation or filing validation is inferred."} ${key==="gstr-9"?"Monthly groups cover the selected period; choose the full financial year for a full-year working summary.":""} No database or ledger writes.`};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
