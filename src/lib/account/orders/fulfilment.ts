import {Prisma} from "@prisma/client";
const D=Prisma.Decimal.clone({precision:48});
type Quantity=Prisma.Decimal|string|number;
export type OrderQuantityLine={id:string;quantity:Quantity;baseQuantity?:Quantity|null};
export type OrderFulfilmentLine={sourceOrderLineId:string;quantity:Quantity;baseQuantity?:Quantity|null};
export type OrderFulfilmentDocument={id:string;status:"DRAFT"|"POSTED"|"CANCELLED";reversed?:boolean;lines:OrderFulfilmentLine[]};
export type OrderQuantitySummary={status:"OPEN"|"CLOSED";reason:"REMAINING"|"FULFILLED"|"MANUAL";lines:{id:string;ordered:string;fulfilled:string;remaining:string}[]};
function primaryQuantity(line:OrderQuantityLine|OrderFulfilmentLine){
 const value=new D(line.baseQuantity??line.quantity);
 if(!value.isFinite()||value.lte(0)||value.decimalPlaces()>4)throw new Error("INVALID_ORDER_QUANTITY");
 return value;
}
/** Requires explicit source-line provenance, never monetary totals or item-name guesses.
 * Caller must authorize the order and targets, establish one consistent DB snapshot and
 * hold the source-order lock when validating a new posting. Drafts never fulfil an order.
 */
export function orderQuantitySummary(orderLines:OrderQuantityLine[],documents:OrderFulfilmentDocument[],manuallyClosed=false):OrderQuantitySummary{
 if(!orderLines.length)throw new Error("ORDER_LINES_REQUIRED");
 const ordered=new Map<string,Prisma.Decimal>();
 for(const line of orderLines){if(!line.id||ordered.has(line.id))throw new Error("DUPLICATE_ORDER_LINE");ordered.set(line.id,primaryQuantity(line))}
 const fulfilled=new Map<string,Prisma.Decimal>(),documentIds=new Set<string>();
 for(const document of documents){
  if(documentIds.has(document.id))throw new Error("DUPLICATE_FULFILMENT_DOCUMENT");documentIds.add(document.id);
  if(document.status!=="POSTED"||document.reversed)continue;
  for(const line of document.lines){if(!ordered.has(line.sourceOrderLineId))throw new Error("INVALID_SOURCE_ORDER_LINE");fulfilled.set(line.sourceOrderLineId,new D(fulfilled.get(line.sourceOrderLineId)??0).add(primaryQuantity(line)))}
 }
 let complete=true;
 const lines=[...ordered].map(([id,quantity])=>{const used=new D(fulfilled.get(id)??0),remaining=new D(quantity).sub(used);if(remaining.lt(0))throw new Error("ORDER_QUANTITY_EXCEEDED");if(remaining.gt(0))complete=false;return{id,ordered:quantity.toFixed(4),fulfilled:used.toFixed(4),remaining:remaining.toFixed(4)}});
 return{status:manuallyClosed||complete?"CLOSED":"OPEN",reason:manuallyClosed?"MANUAL":complete?"FULFILLED":"REMAINING",lines};
}
