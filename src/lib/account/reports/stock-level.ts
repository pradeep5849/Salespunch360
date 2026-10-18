import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {assertInventoryAvailable,inventorySnapshotForActor,listInventoryProductsForActor} from "../inventory";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
/** Uses existing movement valuation and canonical low-stock <= threshold rule.
 * Per-item quantities are never combined across different or unspecified units. */
export async function stockLevelReport(name:string,c:FinancialReportContext):Promise<ReportResult> {
 if(!canUsePermission(c.actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_STOCK"))throw new AuthorizationError();
 const actor=c.f.branchId?{...c.actor,branchAccessScope:"SELECTED_BRANCHES" as const,branchIds:[c.f.branchId]}:c.actor;
 await assertInventoryAvailable(actor);
 const asOf=new Date(`${c.to.toISOString().slice(0,10)}T23:59:59.999Z`);
 let categoryName="All categories";
 if(c.f.categoryId==="UNCATEGORIZED")categoryName="Uncategorized (no category)";
 else if(c.f.categoryId){const category=await db.accountCategory.findFirst({where:{companyId:c.actor.companyId,id:c.f.categoryId},select:{name:true}});if(!category)throw new AuthorizationError();categoryName=category.name}
 const [products,snapshot]=await Promise.all([listInventoryProductsForActor(actor,{includeInactive:true}),inventorySnapshotForActor(actor,asOf)]);
 const amounts=new Map<string,{quantity:Prisma.Decimal;value:Prisma.Decimal}>();
 for(const row of snapshot){const amount=amounts.get(row.productId)??{quantity:new D(0),value:new D(0)};amount.quantity=amount.quantity.add(row.quantity);amount.value=amount.value.add(row.stockValue);amounts.set(row.productId,amount)}
 const rows:ReportResult["rows"]=[];let value=new D(0),lowCount=0;
 for(const product of products){
  if(!product.trackInventory||(c.f.categoryId&&(c.f.categoryId==="UNCATEGORIZED"?product.categoryId!==null:product.categoryId!==c.f.categoryId))||(c.f.itemStatus&&product.isActive!==(c.f.itemStatus==="ACTIVE")))continue;
  const amount=amounts.get(product.id)??{quantity:new D(0),value:new D(0)},low=amount.quantity.lte(product.lowStockThreshold);
  if(name==="low-stock-summary"&&!low)continue;
  if(c.f.stockLevel&&(c.f.stockLevel==="NEGATIVE"?!amount.quantity.lt(0):c.f.stockLevel==="LOW"?!low:!amount.quantity.gt(product.lowStockThreshold)))continue;
  if(low)lowCount++;value=value.add(amount.value);
  rows.push([product.name,product.category?.name??"Uncategorized",product.unit?.symbol||product.unit?.name||"Unit unspecified",amount.quantity.toFixed(4),amount.value.toFixed(2)]);
 }
 return {title:name==="low-stock-summary"?"Low Stock Summary Report":"Stock Summary Report",columns:["Item","Category","Unit","Stock quantity","Value"],rows,summary:[{label:"Item Count",value:String(rows.length),money:false},{label:"Low Stock Count",value:String(lowCount),money:false},{label:"Stock Value",value:value.toFixed(2),money:true}],note:`Closing stock as of ${asOf.toISOString().slice(0,10)} (end of day),including all prior movement history. Category: ${categoryName};item status: ${c.f.itemStatus??"All"};stock level: ${name==="low-stock-summary"?"Low":c.f.stockLevel??"All"}. Category,status and low-stock thresholds use current item metadata. Low stock includes quantities at or below the saved threshold,including negative stock. Values use existing movement valuation;quantities retain four decimals in each primary unit and are not added together. This report does not change stock or the ledger.`};
}
