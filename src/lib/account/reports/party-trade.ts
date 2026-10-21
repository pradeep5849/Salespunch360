import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {economicDocumentsAt} from "../commercial-report-policy";
import {requireAccountModules} from "../modules";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
/** Uses the same gross posted-document amounts/signs as Sale/Purchase Report.
 * Customer and vendor identities are kept separate even when their names match. */
export async function partyTradeReport(c:FinancialReportContext,mode:"TRADE"|"DISCOUNT"|"GST"="TRADE"):Promise<ReportResult> {
 if(!c.actor.companyId)throw new AuthorizationError();
 const discounts=mode==="DISCOUNT",taxes=mode==="GST";
 if(taxes)await requireAccountModules(c.actor,"GST_ADVANCED");else await requireAccountModules(c.actor,"SALES","PURCHASES");
 const saleLabel=taxes?"Sale Tax":discounts?"Sale Discount":"Sales",purchaseLabel=taxes?"Purchase/Expense Tax":discounts?"Purchase/Expense Discount":"Purchases";
 return db.$transaction(async tx=>{
  const groups=new Map<string,{name:string;role:string;sales:Prisma.Decimal;purchases:Prisma.Decimal}>();
  let cursor:string|undefined;
  for(;;){
   const docs=await tx.commercialDocument.findMany({where:{companyId:c.actor.companyId,...c.branch,...economicDocumentsAt(c.to),issueDate:{gte:c.from,lte:c.to},type:{in:["SALES_INVOICE","CREDIT_NOTE","PURCHASE_BILL","DEBIT_NOTE"]}},select:{id:true,type:true,partyId:true,partyName:true,grandTotal:true,discountTotal:true,cgstTotal:true,sgstTotal:true,igstTotal:true,cessTotal:true},orderBy:[{issueDate:"asc"},{createdAt:"asc"},{id:"asc"}],take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   for(const doc of docs){
    const sales=doc.type==="SALES_INVOICE"||doc.type==="CREDIT_NOTE",role=sales?"Customer":"Vendor",key=JSON.stringify([role,doc.partyId]);
    const group=groups.get(key)??{name:doc.partyName,role,sales:new D(0),purchases:new D(0)};
    const amount=(taxes?new D(doc.cgstTotal).add(doc.sgstTotal).add(doc.igstTotal).add(doc.cessTotal):new D(discounts?doc.discountTotal:doc.grandTotal)).mul(doc.type==="CREDIT_NOTE"||doc.type==="DEBIT_NOTE"?-1:1);
    if(sales)group.sales=group.sales.add(amount);else group.purchases=group.purchases.add(amount);
    groups.set(key,group);
   }
   if(docs.length<1000)break;cursor=docs[docs.length-1].id;
  }
  const entries=[...groups.entries()].sort(([ak,a],[bk,b])=>a.name.localeCompare(b.name)||a.role.localeCompare(b.role)||ak.localeCompare(bk));
  const sales=entries.reduce((sum,[,row])=>sum.add(row.sales),new D(0)),purchases=entries.reduce((sum,[,row])=>sum.add(row.purchases),new D(0));
  return {title:taxes?"GST Report":discounts?"Discount Report":"Sale/Purchase by Party",columns:["Party","Party Type",saleLabel,purchaseLabel],rows:entries.map(([,row])=>[row.name,row.role,row.sales.toFixed(2),row.purchases.toFixed(2)]),totals:["Total","",sales.toFixed(2),purchases.toFixed(2)],summary:[{label:`Total ${saleLabel}`,value:sales.toFixed(2),money:true},{label:taxes?"Total Purchase/Expense Tax":discounts?"Total Purchase/Expense Discount":"Total Purchase",value:purchases.toFixed(2),money:true}],note:taxes?"Recorded CGST, SGST, IGST and CESS on posted commercial documents, net of credit/debit notes, for the selected company, branches and period. TDS and TCS are separate withholding/collection amounts and are excluded. Standalone expenses have no party identity; their tax is not attributed to a customer/vendor. Saved party snapshots remain separate by identity and role. This report does not change the ledger.":discounts?"Recorded posted sale/purchase line discounts,net of credit/debit notes,for the selected company,branches and period. Standalone expense records do not store party discounts;no expense discount is inferred. Customer/vendor identities remain separate. This report does not change the ledger.":"Posted document totals for the selected period and authorized branches,including recorded taxes and document discounts. Credit notes reduce sales;debit notes reduce purchases. Amounts match Sale Report/Purchase Report. Customer/vendor identities remain separate;names use saved document snapshots. This report does not change the ledger."};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
