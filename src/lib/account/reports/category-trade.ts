import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {requireAccountModules} from "../modules";
import {economicDocumentsAt} from "../commercial-report-policy";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
const selection={id:true,quantity:true,unitName:true,unitSymbol:true,baseAmount:true,discountAmount:true,taxableAmount:true,taxAmount:true,cessAmount:true,lineTotal:true,product:{select:{categoryId:true,category:{select:{name:true}}}},service:{select:{categoryId:true,category:{select:{name:true}}}},document:{select:{type:true}}} as const satisfies Prisma.CommercialDocumentLineSelect;
type Line=Prisma.CommercialDocumentLineGetPayload<{select:typeof selection}>;
/** Category is current master metadata; all economic amounts and units remain saved snapshots. */
export async function categoryTradeReport(c:FinancialReportContext):Promise<ReportResult>{
 if(!c.actor.companyId||!canUsePermission(c.actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_STOCK"))throw new AuthorizationError();
 await requireAccountModules(c.actor,"SALES","PURCHASES","INVENTORY");
 const settings=await db.accountSettings.findUnique({where:{companyId:c.actor.companyId},select:{itemSettings:true}});
 if((settings?.itemSettings as {enabled?:boolean}|null)?.enabled===false)throw new Error("MODULE_DISABLED:INVENTORY");
 return db.$transaction(async tx=>{
  const groups=new Map<string,{side:string;category:string;unit:string;values:Prisma.Decimal[]}>();let cursor:string|undefined;
  for(;;){
   const lines:Line[]=await tx.commercialDocumentLine.findMany({where:{companyId:c.actor.companyId,document:{is:{companyId:c.actor.companyId,...c.branch,...economicDocumentsAt(c.to),issueDate:{gte:c.from,lte:c.to},type:{in:["SALES_INVOICE","CREDIT_NOTE","PURCHASE_BILL","DEBIT_NOTE"]}}}},select:selection,orderBy:{id:"asc"},take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   for(const line of lines){
    const side=["SALES_INVOICE","CREDIT_NOTE"].includes(line.document.type)?"Sales":"Purchases",master=line.product??line.service;
    const key=JSON.stringify([side,master?.categoryId??null,line.unitName??"",line.unitSymbol??"",line.unitName||line.unitSymbol?"":line.id]);
    const row=groups.get(key)??{side,category:master?.category?.name??"Uncategorized",unit:line.unitSymbol||line.unitName||"Unit unspecified",values:Array.from({length:7},()=>new D(0))};
    const sign=["CREDIT_NOTE","DEBIT_NOTE"].includes(line.document.type)?-1:1;
    [line.quantity,line.baseAmount,line.discountAmount,line.taxableAmount,line.taxAmount,line.cessAmount,line.lineTotal].forEach((value,index)=>{row.values[index]=row.values[index].add(value.mul(sign))});groups.set(key,row);
   }
   if(lines.length<1000)break;cursor=lines[lines.length-1].id;
  }
  const rows=[...groups.entries()].sort(([ak,a],[bk,b])=>a.side.localeCompare(b.side)||a.category.localeCompare(b.category)||a.unit.localeCompare(b.unit)||ak.localeCompare(bk));
  const summaries=["Sales","Purchases"].map(side=>({label:`Net ${side} line total`,value:rows.filter(([,row])=>row.side===side).reduce((sum,[,row])=>sum.add(row.values[6]),new D(0)).toFixed(2),money:true}));
  return{title:"Sale/Purchase by Item Category",columns:["Transaction type","Item Category","Unit","Quantity","Gross before discount/tax","Discount Amount","Taxable","Tax","CESS","Total"],rows:rows.map(([,row])=>[row.side,row.category,row.unit,...row.values.map((value,index)=>value.toFixed(index===0?4:2))]),summary:summaries,note:"Posted sales and purchases in the selected company, authorized branches and period, net of their original billed credit/debit notes. Sales and purchases are separate; their difference is not profit. Categories use current product/service metadata; custom and Work Package lines are Uncategorized. Amounts and units use saved lines. Different saved units and unspecified units remain separate; quantities are not added across units. Invoice charges, withholding and payment discounts are excluded because they are not item allocations. No stock or ledger writes."};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
