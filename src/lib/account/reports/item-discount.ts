import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError,requirePermission} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {requireAccountModules} from "../modules";
import {economicDocumentsAt} from "../commercial-report-policy";
import type {ProjectActor} from "../projects";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
const lineSelection={id:true,lineType:true,productId:true,serviceId:true,workPackageId:true,itemName:true,unitName:true,unitSymbol:true,quantity:true,lineTotal:true,discountAmount:true,document:{select:{type:true}},product:{select:{categoryId:true,category:{select:{name:true}}}},service:{select:{categoryId:true,category:{select:{name:true}}}}} as const satisfies Prisma.CommercialDocumentLineSelect;
type DiscountLine=Prisma.CommercialDocumentLineGetPayload<{select:typeof lineSelection}>;
export async function itemDiscountCategoriesForActor(actor:ProjectActor){
 if(!actor.companyId||!["ACCOUNT_ADMIN","ACCOUNTANT"].includes(actor.accountRole??"")||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_REPORTS"))throw new AuthorizationError();
 await requireAccountModules(actor,"SALES");
 const rows=await db.accountCategory.findMany({where:{companyId:actor.companyId},select:{id:true,name:true},orderBy:[{name:"asc"},{id:"asc"}]});
 return[{id:"UNCATEGORIZED",name:"Uncategorized (no item category)"},...rows];
}
export async function itemDiscountCategories(){return itemDiscountCategoriesForActor(await requirePermission("ACCOUNT_REPORTS") as ProjectActor)}
/** Stored line discounts only: payment-settlement discounts cannot be attributed to items. */
export async function itemDiscountReport(c:FinancialReportContext):Promise<ReportResult>{
 if(!c.actor.companyId)throw new AuthorizationError();await requireAccountModules(c.actor,"SALES");
 return db.$transaction(async tx=>{
  if(c.f.categoryId&&c.f.categoryId!=="UNCATEGORIZED"&&!await tx.accountCategory.findFirst({where:{companyId:c.actor.companyId,id:c.f.categoryId},select:{id:true}}))throw new AuthorizationError();
  const category=c.f.categoryId==="UNCATEGORIZED"?null:c.f.categoryId;
  const categoryFilter:Prisma.CommercialDocumentLineWhereInput=c.f.categoryId?{OR:[{product:{is:{categoryId:category}}},{service:{is:{categoryId:category}}},...(category===null?[{productId:null,serviceId:null}]:[])]}:{};
  const groups=new Map<string,{name:string;category:string;unit:string;quantity:Prisma.Decimal;sales:Prisma.Decimal;discount:Prisma.Decimal}>();let cursor:string|undefined;
  for(;;){
   const lines:DiscountLine[]=await tx.commercialDocumentLine.findMany({where:{companyId:c.actor.companyId,discountAmount:{not:0},...categoryFilter,...(c.f.itemSearch?{itemName:{contains:c.f.itemSearch.replace(/[\\%_]/g,"\\$&"),mode:"insensitive" as const}}:{}),document:{is:{companyId:c.actor.companyId,...c.branch,...economicDocumentsAt(c.to),issueDate:{gte:c.from,lte:c.to},type:{in:["SALES_INVOICE","CREDIT_NOTE"]},...(c.f.customerId?{customerId:c.f.customerId}:{})}}},select:lineSelection,orderBy:{id:"asc"},take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   for(const line of lines){
    const master=line.product??line.service,key=JSON.stringify([line.lineType,line.productId??line.serviceId??line.workPackageId??line.itemName,line.itemName,master?.categoryId??null,line.unitName??"",line.unitSymbol??"",line.unitName||line.unitSymbol?"":line.id]);
    const row=groups.get(key)??{name:line.itemName,category:master?.category?.name??"Uncategorized",unit:line.unitSymbol||line.unitName||"Unit unspecified",quantity:new D(0),sales:new D(0),discount:new D(0)},sign=line.document.type==="CREDIT_NOTE"?-1:1;
    row.quantity=row.quantity.add(line.quantity.mul(sign));row.sales=row.sales.add(line.lineTotal.mul(sign));row.discount=row.discount.add(line.discountAmount.mul(sign));groups.set(key,row);
   }
   if(lines.length<1000)break;cursor=lines[lines.length-1].id;
  }
  const entries=[...groups.entries()].sort(([ak,a],[bk,b])=>a.name.localeCompare(b.name)||a.unit.localeCompare(b.unit)||ak.localeCompare(bk)),sales=entries.reduce((sum,[,row])=>sum.add(row.sales),new D(0)),discount=entries.reduce((sum,[,row])=>sum.add(row.discount),new D(0));
  return{title:"Item Wise Discount Report",columns:["Item","Item Category","Unit","Quantity","Sale Amount","Discount Amount"],rows:entries.map(([,row])=>[row.name,row.category,row.unit,row.quantity.toFixed(4),row.sales.toFixed(2),row.discount.toFixed(2)]),totals:["Total","","","",sales.toFixed(2),discount.toFixed(2)],summary:[{label:"Total Sale Amount",value:sales.toFixed(2),money:true},{label:"Total Discount Amount",value:discount.toFixed(2),money:true}],note:"Only posted sales lines with a recorded item discount are included, net of credit notes. Sale Amount is the saved line total after item discount, including line taxes; invoice freight/other charges and payment-settlement discounts are excluded. Quantities use the saved invoice unit; different units and item identities remain separate. Unspecified units stay separate per line. Category filters use current product/service item categories; custom lines and Work Packages have no item category. Saved names and amounts are retained. Company/authorized branches and selected period only."};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
