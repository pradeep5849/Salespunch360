import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {requireAccountModules} from "../modules";
import {economicDocumentsAt} from "../commercial-report-policy";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
const policies={"tcs-collected":{title:"TCS Collected Report",component:"tcsAmount",column:"TCS",sales:true},"tds-receivable":{title:"TDS Receivable",component:"tdsAmount",column:"TDS",sales:true},"tds-payable":{title:"TDS Payable",component:"tdsAmount",column:"TDS",sales:false},"tcs-receivable":{title:"TCS Receivable",component:"tcsAmount",column:"TCS",sales:false}} as const;
export const WITHHOLDING_REPORTS=Object.keys(policies);
const select={id:true,type:true,issueDate:true,documentNumber:true,partyName:true,taxableTotal:true,tdsAmount:true,tcsAmount:true} as const satisfies Prisma.CommercialDocumentSelect;
type Row=Prisma.CommercialDocumentGetPayload<{select:typeof select}>;
/** Recorded invoice tax activity, not a statutory return or government-credit reconciliation. */
export async function withholdingReport(c:FinancialReportContext,key:string):Promise<ReportResult>{
 const policy=policies[key as keyof typeof policies];if(!policy)throw new Error("INVALID_REPORT");await requireAccountModules(c.actor,"GST_ADVANCED");
 return db.$transaction(async tx=>{
  const rows:ReportResult["rows"]=[];let cursor:string|undefined,taxable=new D(0),tax=new D(0);
  for(;;){
   const documents:Row[]=await tx.commercialDocument.findMany({where:{companyId:c.actor.companyId,...c.branch,...economicDocumentsAt(c.to),issueDate:{gte:c.from,lte:c.to},type:{in:policy.sales?["SALES_INVOICE","CREDIT_NOTE"]:["PURCHASE_BILL","DEBIT_NOTE"]},[policy.component]:{not:0},...(c.f.customerId?{customerId:c.f.customerId}:{}),...(c.f.vendorId?{vendorId:c.f.vendorId}:{})},select,orderBy:[{issueDate:"asc"},{id:"asc"}],take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   for(const doc of documents){const sign=doc.type==="CREDIT_NOTE"||doc.type==="DEBIT_NOTE"?-1:1,base=new D(doc.taxableTotal).mul(sign),amount=new D(doc[policy.component]).mul(sign);taxable=taxable.add(base);tax=tax.add(amount);rows.push([doc.issueDate.toISOString().slice(0,10),doc.documentNumber,doc.partyName,doc.type.replaceAll("_"," "),base.toFixed(2),amount.toFixed(2)])}
   if(documents.length<1000)break;cursor=documents[documents.length-1].id;
  }
  return{title:policy.title,columns:["Date","Document","Party","Transaction Type","Taxable",policy.column],rows,totals:["Total","","","",taxable.toFixed(2),tax.toFixed(2)],summary:[{label:`Recorded ${policy.column}`,value:tax.toFixed(2),money:true}],note:`${policy.title}: stored ${policy.column} ${policy.sales?(policy.component==="tcsAmount"?"collections on sales":"deductions on sales"):"amounts on purchases"}, net of corresponding posted return notes, in the authorized company/branches and selected period. Taxable is the saved document taxable base, not an inferred statutory section base. This is recorded invoice activity, not proof of remittance, eligible government tax credit, an unpaid statutory balance, or a filing. Payment timing, challan/section/certificate reconciliation and Form 27EQ filing are not inferred. No entries are recalculated or posted.`};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
