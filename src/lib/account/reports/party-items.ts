import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {requireAccountModules} from "../modules";
import {economicDocumentsAt} from "../commercial-report-policy";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
const selection={id:true,lineType:true,productId:true,serviceId:true,workPackageId:true,itemName:true,unitName:true,unitSymbol:true,quantity:true,baseAmount:true,discountAmount:true,taxableAmount:true,taxAmount:true,cessAmount:true,lineTotal:true,document:{select:{type:true,partyId:true,partyName:true}}} as const satisfies Prisma.CommercialDocumentLineSelect;
type Line=Prisma.CommercialDocumentLineGetPayload<{select:typeof selection}>;
/** Saved line/unit/party snapshots only. Different identities and units cannot be merged by name. */
export async function partyItemsReport(c:FinancialReportContext,itemsFirst=false):Promise<ReportResult>{
 if(!c.actor.companyId)throw new AuthorizationError();
 await requireAccountModules(c.actor,"SALES","PURCHASES");
 return db.$transaction(async tx=>{
  const groups=new Map<string,{party:string;role:string;item:string;kind:string;unit:string;values:Prisma.Decimal[]}>();let cursor:string|undefined;
  const sides:Prisma.CommercialDocumentWhereInput[]=[];
  if(!c.f.vendorId||c.f.customerId)sides.push({type:{in:["SALES_INVOICE","CREDIT_NOTE"]},...(c.f.customerId?{customerId:c.f.customerId}:{})});
  if(!c.f.customerId||c.f.vendorId)sides.push({type:{in:["PURCHASE_BILL","DEBIT_NOTE"]},...(c.f.vendorId?{vendorId:c.f.vendorId}:{})});
  for(;;){
   const lines:Line[]=await tx.commercialDocumentLine.findMany({where:{companyId:c.actor.companyId,...(c.f.productId?{productId:c.f.productId}:{}),...(c.f.itemSearch?{itemName:{contains:c.f.itemSearch.replace(/[\\%_]/g,"\\$&"),mode:"insensitive" as const}}:{}),document:{is:{companyId:c.actor.companyId,...c.branch,...economicDocumentsAt(c.to),issueDate:{gte:c.from,lte:c.to},OR:sides}}},select:selection,orderBy:{id:"asc"},take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   for(const line of lines){
    const role=["SALES_INVOICE","CREDIT_NOTE"].includes(line.document.type)?"Customer":"Vendor",sign=["CREDIT_NOTE","DEBIT_NOTE"].includes(line.document.type)?-1:1;
    const key=JSON.stringify([role,line.document.partyId,line.document.partyName,line.lineType,line.productId??line.serviceId??line.workPackageId??line.id,line.itemName,line.unitName??"",line.unitSymbol??"",line.unitName||line.unitSymbol?"":line.id]);
    const group=groups.get(key)??{party:line.document.partyName,role,item:line.itemName,kind:line.lineType.replaceAll("_"," "),unit:line.unitSymbol||line.unitName||"Unit unspecified",values:Array.from({length:7},()=>new D(0))};
    const amounts=[line.quantity,line.baseAmount,line.discountAmount,line.taxableAmount,line.taxAmount,line.cessAmount,line.lineTotal];amounts.forEach((amount,index)=>{group.values[index]=group.values[index].add(new D(amount).mul(sign))});groups.set(key,group);
   }
   if(lines.length<1000)break;cursor=lines[lines.length-1].id;
  }
  const entries=[...groups.entries()].sort(([ak,a],[bk,b])=>(itemsFirst?a.item.localeCompare(b.item)||a.party.localeCompare(b.party):a.party.localeCompare(b.party)||a.item.localeCompare(b.item))||a.role.localeCompare(b.role)||a.unit.localeCompare(b.unit)||ak.localeCompare(bk));
  const totals=Array.from({length:6},()=>new D(0));for(const [,row]of entries)row.values.slice(1).forEach((value,index)=>{totals[index]=totals[index].add(value)});
  const leading=itemsFirst?["Item","Item Type","Party","Party Type"]:["Party","Party Type","Item","Item Type"];
  return{title:itemsFirst?"Item Report by Party":"Party Report by Items",columns:[...leading,"Unit","Quantity","Gross before discount/tax","Discount Amount","Taxable","Tax","CESS","Total"],rows:entries.map(([,row])=>[...(itemsFirst?[row.item,row.kind,row.party,row.role]:[row.party,row.role,row.item,row.kind]),row.unit,...row.values.map((value,index)=>value.toFixed(index===0?4:2))]),totals:["Net line totals","","","","","—",...totals.map(value=>value.toFixed(2))],note:"Posted sales and purchases, net of credit/debit note lines, in the selected company, authorized branches and period. Customer and Vendor identities remain separate even when names match. Party/item names, units and values use saved document snapshots; quantities with different or unspecified units remain separate. Customer filter includes only that customer's sale/return lines; Vendor filter includes only that vendor's purchase/return lines; selecting both includes both selected parties. Gross, discount, taxable, tax, cess and total are recorded line amounts. Invoice charges, withholding and payment discounts are excluded because they are not item allocations. Net line totals combine sales and purchases for listing reconciliation only; they are not profit, revenue, cash movement or party balance. No financial writes."};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
