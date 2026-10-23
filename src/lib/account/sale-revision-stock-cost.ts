import {Prisma} from "@prisma/client";
import {commercialBaseQuantity} from "./commercial-stock-quantity";
import {stockValuation} from "./inventory";
const D=Prisma.Decimal.clone({precision:48});
type Pool={productId:string;warehouseId:string;batchId:string|null;serialNumberId:string|null};
const key=(row:Pool)=>JSON.stringify([row.productId,row.warehouseId,row.batchId,row.serialNumberId]);
/** A revision is not another shipment of the retained units. Pool across duplicate
 * lines so moving quantity between lines for the same stock does not revalue it.
 * Snapshot before the technical reversal: only genuinely additional units use
 * the current weighted cost. Posted original costs and returns stay unchanged. */
export async function saleRevisionStockCostsInTx(tx:Prisma.TransactionClient,companyId:string,source:{id:string;journalEntryId:string|null;projectId:string|null},replacementId:string){
 const [movements,lines]=await Promise.all([
  tx.stockMovement.findMany({where:{companyId,sourceType:"SALES_INVOICE",sourceId:source.id,movementType:"SALE"},orderBy:{id:"asc"}}),
  tx.commercialDocumentLine.findMany({where:{companyId,documentId:replacementId,productId:{not:null},warehouseId:{not:null}},orderBy:{position:"asc"}}),
 ]);
 // Never silently revalue a historically inconsistent non-Project invoice.
 // Project material recognition is separate from commercial stock posting.
 if(movements.length&&source.projectId===null){
  if(!source.journalEntryId)throw new Error("SALE_STOCK_SOURCE_HISTORY_REQUIRED");
  const ledger=await tx.journalLine.aggregate({where:{companyId,journalEntryId:source.journalEntryId,ledgerAccount:{systemKey:"COGS"}},_sum:{debit:true,credit:true}}),posted=new D(ledger._sum.debit??0).sub(ledger._sum.credit??0),stock=movements.reduce((sum,row)=>sum.add(row.totalCost),new D(0));
  if(!posted.eq(stock))throw new Error("SALE_STOCK_COST_HISTORY_INCONSISTENT");
 }
 const pools=new Map<string,{pool:Pool;quantity:Prisma.Decimal;cost:Prisma.Decimal}>();
 for(const row of movements){const pool={productId:row.productId,warehouseId:row.warehouseId,batchId:row.batchId,serialNumberId:row.serialNumberId},id=key(pool),value=pools.get(id)??{pool,quantity:new D(0),cost:new D(0)};value.quantity=value.quantity.add(row.quantity);value.cost=value.cost.add(row.totalCost);pools.set(id,value)}
 const costs=new Map<string,Prisma.Decimal>(),snapshot:Array<{productId:string;warehouseId:string;batchId:string|null;serialNumberId:string|null;originalQuantity:string;originalCost:string;replacementQuantity:string;replacementCost:string;currentUnitCost:string;lines:Array<{id:string;cost:string}>}>=[];
 for(const {pool,quantity:oldQuantity,cost:oldCost}of pools.values()){
  const retained=lines.filter(line=>key({productId:line.productId!,warehouseId:line.warehouseId!,batchId:line.batchId,serialNumberId:line.serialNumberId})===key(pool));
  if(!retained.length)continue;
  const quantity=retained.reduce((sum,line)=>sum.add(commercialBaseQuantity(line)),new D(0));
  if(!oldQuantity.gt(0)||oldCost.lt(0)||!quantity.gt(0))throw new Error("SALE_STOCK_SOURCE_HISTORY_REQUIRED");
  const prior=await tx.stockMovement.findMany({where:{companyId,warehouseId:pool.warehouseId,productId:pool.productId,...(pool.batchId?{batchId:pool.batchId}:{}),...(pool.serialNumberId?{serialNumberId:pool.serialNumberId}:{})},orderBy:[{movementDate:"asc"},{createdAt:"asc"}]}),valuation=stockValuation(prior),current=valuation.quantity.gt(0)?valuation.stockValue.div(valuation.quantity):valuation.averageUnitCost;
  const originalPortion=oldCost.mul(Prisma.Decimal.min(oldQuantity,quantity)).div(oldQuantity),additional=Prisma.Decimal.max(0,quantity.sub(oldQuantity));
  const total=originalPortion.add(additional.mul(current)).toDecimalPlaces(2);
  if(!total.isFinite()||total.lt(0))throw new Error("SALE_STOCK_SOURCE_HISTORY_REQUIRED");
  let remaining=new D(total);const allocation:Array<{id:string;cost:string}>=[];
  for(let i=0;i<retained.length;i++){const line=retained[i],value=i===retained.length-1?remaining:total.mul(commercialBaseQuantity(line)).div(quantity).toDecimalPlaces(2,Prisma.Decimal.ROUND_DOWN);remaining=remaining.sub(value);costs.set(line.id,new D(value));allocation.push({id:line.id,cost:value.toFixed(2)})}
  snapshot.push({...pool,originalQuantity:oldQuantity.toString(),originalCost:oldCost.toFixed(2),replacementQuantity:quantity.toString(),replacementCost:total.toFixed(2),currentUnitCost:current.toString(),lines:allocation});
 }
 return{costs,snapshot};
}
