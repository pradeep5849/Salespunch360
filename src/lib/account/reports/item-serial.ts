import {Prisma,type InventorySerialNumber,type StockMovement} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {assertInventoryAvailable} from "../inventory";
import {signedQuantity} from "../inventory-policy";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
/** Company serial masters have no branch owner. Restricted users see only serials
 * with movement history in their permitted warehouses; unassigned masters stay private. */
export async function itemSerialReport(c:FinancialReportContext):Promise<ReportResult>{
 if(!c.actor.companyId||!canUsePermission(c.actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_STOCK"))throw new AuthorizationError();
 await assertInventoryAvailable(c.actor);
 const to=new Date(`${c.to.toISOString().slice(0,10)}T23:59:59.999Z`),restricted=Boolean(c.f.branchId)||c.actor.branchAccessScope==="SELECTED_BRANCHES";
 return db.$transaction(async tx=>{
  const warehouses=await tx.warehouse.findMany({where:{companyId:c.actor.companyId,...c.branch},select:{id:true,name:true}}),warehouseNames=new Map(warehouses.map(row=>[row.id,row.name]));
  const rows:Array<Array<string|number>>=[];let cursor:string|undefined;
  for(;;){
   const serials:InventorySerialNumber[]=await tx.inventorySerialNumber.findMany({where:{companyId:c.actor.companyId,...(c.f.productId?{productId:c.f.productId}:{})},orderBy:{id:"asc"},take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   if(!serials.length)break;
   const products=await tx.accountProduct.findMany({where:{companyId:c.actor.companyId,id:{in:[...new Set(serials.map(row=>row.productId))]},...(c.f.itemSearch?{name:{contains:c.f.itemSearch.replace(/[\\%_]/g,"\\$&"),mode:"insensitive" as const}}:{})},select:{id:true,name:true,unit:{select:{name:true,symbol:true}}}}),productMap=new Map(products.map(row=>[row.id,row]));
   const selected=serials.filter(row=>productMap.has(row.productId)),serialProducts=new Map(serials.map(row=>[row.id,row.productId])),balances=new Map<string,Map<string,Prisma.Decimal>>(),seen=new Set<string>();let movementCursor:string|undefined;
   if(selected.length&&warehouses.length)for(;;){
    const movements:Array<Pick<StockMovement,"id"|"serialNumberId"|"productId"|"warehouseId"|"movementType"|"quantity">>=await tx.stockMovement.findMany({where:{companyId:c.actor.companyId,...c.branch,serialNumberId:{in:selected.map(row=>row.id)},warehouseId:{in:warehouses.map(row=>row.id)},movementDate:{lte:to}},select:{id:true,serialNumberId:true,productId:true,warehouseId:true,movementType:true,quantity:true},orderBy:{id:"asc"},take:1000,...(movementCursor?{cursor:{id:movementCursor},skip:1}:{})});
    for(const movement of movements){if(!movement.serialNumberId||serialProducts.get(movement.serialNumberId)!==movement.productId)continue;seen.add(movement.serialNumberId);const locations=balances.get(movement.serialNumberId)??new Map<string,Prisma.Decimal>();locations.set(movement.warehouseId,(locations.get(movement.warehouseId)??new D(0)).add(signedQuantity(movement.movementType,movement.quantity)));balances.set(movement.serialNumberId,locations);}
    if(movements.length<1000)break;movementCursor=movements[movements.length-1].id;
   }
   for(const serial of selected){
    if(restricted&&!seen.has(serial.id))continue;
    const product=productMap.get(serial.productId)!,locations=balances.get(serial.id)??new Map<string,Prisma.Decimal>(),quantity=[...locations.values()].reduce((sum,value)=>sum.add(value),new D(0));
    const names=[...locations].filter(([,value])=>!value.isZero()).sort(([a],[b])=>a.localeCompare(b)).map(([id,value])=>`${warehouseNames.get(id)??"Unavailable warehouse"}: ${value.toFixed(4)}`).join("; ");
    rows.push([product.name,serial.serialNumber,product.unit?.symbol||product.unit?.name||"Unit unspecified",quantity.toFixed(4),serial.expiryDate?.toISOString().slice(0,10)??"",names||"No stock in selected scope"]);
   }
   if(serials.length<1000)break;cursor=serials[serials.length-1].id;
  }
  rows.sort((a,b)=>String(a[0]).localeCompare(String(b[0]))||String(a[1]).localeCompare(String(b[1])));
  return{title:"Item Serial Report",columns:["Item","Serial Number","Unit","Quantity","Expiry","Locations"],rows,summary:[{label:"Serial records",value:String(rows.length),money:false}],note:`Closing serial quantities through ${to.toISOString().slice(0,10)} (end of day), including all earlier movement history. Start date does not limit opening stock. Quantities use primary units and authorized warehouses, including inactive warehouses. Item names/units/expiry use current registered metadata. Company-wide users can see unassigned serial masters with zero stock; branch-restricted users see only serials with authorized movement history. Identical serial text on different items stays separate. No stock or ledger changes.`};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
