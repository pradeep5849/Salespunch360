import {Prisma} from '@prisma/client';
type Movement={id:string;sourceType:string;sourceId:string;movementType:string;productId:string;branchId:string;warehouseId:string;quantity:Prisma.Decimal;unitCost:Prisma.Decimal;totalCost:Prisma.Decimal;batchId:string|null;serialNumberId:string|null;movementDate:Date};
/** The warehouse transfer writer persists exactly one OUT and one IN for one product/lot. */
export function mismatchedTransferSources(movements:Movement[],warehouses:{id:string;branchId:string}[]):string[]{
 const groups=new Map<string,Movement[]>(),warehouseBranches=new Map(warehouses.map(row=>[row.id,row.branchId]));
 for(const row of movements){
  // Project receipt/issue/return bridges use other source types and are not warehouse transfers.
  if(row.sourceType!=='TRANSFER')continue;
  const key=row.sourceId||row.id,rows=groups.get(key)??[];rows.push(row);groups.set(key,rows);
 }
 return [...groups].filter(([,rows])=>{
  if(rows.length!==2)return true;
  const outgoing=rows.find(row=>row.movementType==='TRANSFER_OUT'),incoming=rows.find(row=>row.movementType==='TRANSFER_IN');
  if(!outgoing||!incoming)return true;
  return rows.some(row=>!row.sourceId||row.quantity.lte(0)||row.unitCost.lt(0)||row.totalCost.lt(0)||warehouseBranches.get(row.warehouseId)!==row.branchId)
   ||outgoing.warehouseId===incoming.warehouseId||outgoing.productId!==incoming.productId
   ||!outgoing.quantity.equals(incoming.quantity)||!outgoing.unitCost.equals(incoming.unitCost)||!outgoing.totalCost.equals(incoming.totalCost)
   ||outgoing.batchId!==incoming.batchId||outgoing.serialNumberId!==incoming.serialNumberId
   ||outgoing.movementDate.getTime()!==incoming.movementDate.getTime();
 }).map(([source])=>source);
}
