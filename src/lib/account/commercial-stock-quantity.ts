import {Prisma} from "@prisma/client";
import {resolveCommercialUnitSnapshot} from "./commercial-unit-snapshot";
const D=Prisma.Decimal;
/** NULL is historical primary-unit meaning, never today's item conversion. */
export function commercialBaseQuantity(row:{quantity:Prisma.Decimal;baseQuantity?:Prisma.Decimal|null}){
 return new D(row.baseQuantity??row.quantity);
}
/** stockReturnBaseQuantity is an internal posting override after Project returns;
 * it is never accepted from request input or written over posted document data. */
export function commercialReturnBaseQuantity(row:{stockReturnQuantity:Prisma.Decimal;unitConversionSnapshot?:unknown;unitName?:string|null;unitSymbol?:string|null;stockReturnBaseQuantity?:Prisma.Decimal}){
 const quantity=new D(row.stockReturnBaseQuantity??row.stockReturnQuantity);
 if(!quantity.isFinite()||quantity.lt(0))throw new Error("INVALID_RETURN_QUANTITY");
 if(quantity.eq(0)||row.stockReturnBaseQuantity!==undefined)return quantity;
 return new D(resolveCommercialUnitSnapshot({quantity:quantity.toString()},{unitConversionSnapshot:row.unitConversionSnapshot??null,unitName:row.unitName??null,unitSymbol:row.unitSymbol??null}).baseQuantity);
}
