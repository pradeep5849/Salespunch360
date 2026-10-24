import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {canUsePermission} from "@/lib/auth/permissions";
import {documentOutstandingsBatch} from "@/lib/account/commercial";
type Actor=Parameters<typeof canUsePermission>[0]&{companyId?:string|null;branchAccessScope?:string;branchIds?:string[]};
type Quote={id:string;branchId:string;customerId:string|null;convertedCommercialDocumentId:string|null};
export type QuotationBilling={kind:"NOT_BILLED"|"SALE"|"SALE_ORDER"|"UNAVAILABLE";documentId?:string;documentNumber?:string;status?:string;outstanding?:string};
/** Quote totals are offers, never receivables. Only expose an authorized saved sale balance. */
export async function quotationBillingForActor(actor:Actor,quotes:Quote[],enabled:string[]):Promise<Map<string,QuotationBilling>>{
 const result=new Map<string,QuotationBilling>(quotes.map(q=>[q.id,{kind:q.convertedCommercialDocumentId?"UNAVAILABLE":"NOT_BILLED"}]));
 const converted=quotes.filter(q=>q.convertedCommercialDocumentId);
 if(!converted.length||!actor.companyId||!enabled.includes("SALES")||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_LEDGER_VIEW"))return result;
 const companyId=actor.companyId;
 return db.$transaction(async tx=>{
  const docs=await tx.commercialDocument.findMany({where:{companyId,id:{in:converted.map(q=>q.convertedCommercialDocumentId!)},...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{}),type:{in:["SALES_INVOICE","SALES_ORDER"]},status:{in:["POSTED","CANCELLED"]}},select:{id:true,branchId:true,customerId:true,type:true,status:true,documentNumber:true,grandTotal:true,payableAmount:true,journalEntry:{select:{status:true}}}});
  const active=docs.filter(d=>d.type==="SALES_INVOICE"&&d.status==="POSTED"&&d.journalEntry?.status!=="REVERSED");
  const balances=await documentOutstandingsBatch(companyId,active,undefined,tx);
  for(const q of converted){const d=docs.find(d=>d.id===q.convertedCommercialDocumentId&&d.branchId===q.branchId&&d.customerId===q.customerId);if(!d)continue;
   result.set(q.id,{kind:d.type==="SALES_INVOICE"?"SALE":"SALE_ORDER",documentId:d.id,documentNumber:d.documentNumber,status:d.journalEntry?.status==="REVERSED"?"REVERSED":d.status,...(d.type==="SALES_INVOICE"?{outstanding:(balances.get(d.id)??new Prisma.Decimal(0)).toFixed(2)}:{})});
  }
  return result;
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
