import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {canUsePermission} from "@/lib/auth/permissions";
import {resolveItemSettings} from "@/lib/account/item-settings-policy";
import {signedQuantity} from "@/lib/account/inventory-policy";
import type {ProjectActor} from "@/lib/account/projects";
const Quantity=Prisma.Decimal.clone({precision:48});
/** Quantity only: no valuation/cost data, stock reservation or posting in an estimate editor. */
export async function quotationStockOptionsForActor(actor:ProjectActor,productIds:readonly string[],asOf?:Date){
 if(!actor.companyId||actor.accountRole==="PROJECT_MANAGER"||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_STOCK"))return null;
 return db.$transaction(async tx=>{
  const settings=await tx.accountSettings.findUnique({where:{companyId:actor.companyId!},select:{itemSettings:true}}),policy=resolveItemSettings(settings?.itemSettings);
  if(!policy.enabled||!policy.stockMaintenance)return null;
  if(!productIds.length)return {positions:[]};
  const warehouses=await tx.warehouse.findMany({where:{companyId:actor.companyId!,isActive:true,...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{})},select:{id:true,branchId:true}});
  if(!warehouses.length)return {positions:[]};
  const rows=await tx.stockMovement.groupBy({by:["productId","warehouseId","movementType"],where:{companyId:actor.companyId!,productId:{in:[...productIds]},warehouseId:{in:warehouses.map(row=>row.id)},...(asOf?{movementDate:{lte:asOf}}:{})},_sum:{quantity:true}});
  const branches=new Map(warehouses.map(row=>[row.id,row.branchId])),allowed=new Set(productIds),totals=new Map<string,{productId:string;branchId:string;quantity:Prisma.Decimal}>();
  for(const row of rows){
   const branchId=branches.get(row.warehouseId);if(!branchId||!allowed.has(row.productId))continue;
   const key=`${branchId}:${row.productId}`,previous=totals.get(key),quantity=signedQuantity(row.movementType,new Quantity(row._sum.quantity?.toString()??"0"));
   totals.set(key,{branchId,productId:row.productId,quantity:(previous?.quantity??new Quantity(0)).add(quantity)});
  }
  return {positions:[...totals.values()].map(row=>({...row,quantity:row.quantity.toFixed(4)})).sort((a,b)=>a.branchId.localeCompare(b.branchId)||a.productId.localeCompare(b.productId))};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
