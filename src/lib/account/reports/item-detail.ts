import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {requireAccountModules} from "../modules";
import {assertInventoryAvailable} from "../inventory";
import {saleInvoiceIdentities} from "../sale-invoice-identity";
import {economicDocumentsAt} from "../commercial-report-policy";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
const selection={id:true,position:true,lineType:true,itemName:true,unitName:true,unitSymbol:true,quantity:true,rate:true,baseAmount:true,discountAmount:true,taxableAmount:true,taxAmount:true,cessAmount:true,lineTotal:true,document:{select:{id:true,companyId:true,branchId:true,type:true,documentNumber:true,issueDate:true,partyName:true}}} as const satisfies Prisma.CommercialDocumentLineSelect;
type Line=Prisma.CommercialDocumentLineGetPayload<{select:typeof selection}>;
/** Saved billed lines, not reconstructed from today's product price or unit. */
export async function itemDetailReport(c:FinancialReportContext):Promise<ReportResult>{
 if(!c.actor.companyId||!canUsePermission(c.actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_STOCK"))throw new AuthorizationError();
 await requireAccountModules(c.actor,"SALES","PURCHASES");await assertInventoryAvailable(c.actor);
 return db.$transaction(async tx=>{
  const rows:ReportResult["rows"]=[],totals=Array.from({length:6},()=>new D(0));let cursor:string|undefined;
  const sides:Prisma.CommercialDocumentWhereInput[]=[];
  if(!c.f.vendorId||c.f.customerId)sides.push({type:{in:["SALES_INVOICE","CREDIT_NOTE"]},...(c.f.customerId?{customerId:c.f.customerId}:{})});
  if(!c.f.customerId||c.f.vendorId)sides.push({type:{in:["PURCHASE_BILL","DEBIT_NOTE"]},...(c.f.vendorId?{vendorId:c.f.vendorId}:{})});
  for(;;){
   const lines:Line[]=await tx.commercialDocumentLine.findMany({where:{companyId:c.actor.companyId,...(c.f.productId?{productId:c.f.productId}:{}),...(c.f.itemSearch?{itemName:{contains:c.f.itemSearch.replace(/[\\%_]/g,"\\$&"),mode:"insensitive" as const}}:{}),document:{is:{companyId:c.actor.companyId,...c.branch,...economicDocumentsAt(c.to),issueDate:{gte:c.from,lte:c.to},OR:sides}}},select:selection,orderBy:[{document:{issueDate:"asc"}},{documentId:"asc"},{position:"asc"},{id:"asc"}],take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   const identities=await saleInvoiceIdentities(tx,c.actor.companyId,lines.map(line=>line.document));
   for(const line of lines){const sign=["CREDIT_NOTE","DEBIT_NOTE"].includes(line.document.type)?-1:1,values=[line.baseAmount,line.discountAmount,line.taxableAmount,line.taxAmount,line.cessAmount,line.lineTotal].map(value=>new D(value).mul(sign));values.forEach((value,index)=>{totals[index]=totals[index].add(value)});rows.push([line.document.issueDate.toISOString().slice(0,10),identities.get(line.document.id)!.printedNumber,line.document.type.replaceAll("_"," "),line.document.partyName,line.itemName,line.lineType.replaceAll("_"," "),line.unitSymbol||line.unitName||"Unit unspecified",line.quantity.mul(sign).toFixed(4),line.rate.toFixed(4),...values.map(value=>value.toFixed(2))])}
   if(lines.length<1000)break;cursor=lines[lines.length-1].id;
  }
  return{title:"Item Detail Report",columns:["Date","Document","Transaction Type","Party","Item","Item Type","Unit","Quantity","Price / unit","Gross before discount/tax","Discount Amount","Taxable","Tax","CESS","Total"],rows,totals:["Net line totals","","","","","","","—","",...totals.map(value=>value.toFixed(2))],note:"Saved posted sale/purchase billed lines in the selected company, authorized branches and period. Return quantities and recorded amounts are negative; original billed return prices remain unchanged. Prices and quantities retain four decimals and their saved unit; no quantities are added across units. Corrected Sales retain their original printed invoice number. Customer selection shows only selected sale/return lines; Vendor selection shows only selected purchase/return lines; selecting both includes both selected parties. Gross, discounts, tax, CESS and totals use recorded line snapshots. Invoice charges, withholding and payment discounts are not item allocations. Net line totals combine sides for listing reconciliation and are not revenue, profit or cash flow. No stock or ledger writes."};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
