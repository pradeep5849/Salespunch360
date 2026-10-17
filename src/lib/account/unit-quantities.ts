import {Prisma} from "@prisma/client";
import {validUnitConversionRate} from "./unit-conversion-rate";
const Exact=Prisma.Decimal.clone({precision:48});
export type ItemUnitSelection="PRIMARY"|"SECONDARY";
function factor(value:string|undefined){if(!value||!validUnitConversionRate(value))throw new Error("UNIT_CONVERSION_UNAVAILABLE");return new Exact(value);}
/** Quantities remain exact at the existing stock precision. Never round a fractional stock movement silently. */
export function quantityInBaseUnits(quantity:string,selection:ItemUnitSelection,secondaryUnitsPerBase?:string){
 let entered:Prisma.Decimal;
 try{entered=new Exact(quantity)}catch{throw new Error("INVALID_UNIT_QUANTITY")}
 if(!entered.isFinite()||entered.lte(0)||entered.decimalPlaces()>4)throw new Error("INVALID_UNIT_QUANTITY");
 const ratio=selection==="SECONDARY"?factor(secondaryUnitsPerBase):new Exact(1);
 const base=entered.div(ratio).toDecimalPlaces(4,Prisma.Decimal.ROUND_HALF_UP);
 if(!base.mul(ratio).equals(entered))throw new Error("UNIT_CONVERSION_PRECISION");
 if(base.gte("100000000000000")||entered.gte("100000000000000"))throw new Error("UNIT_CONVERSION_OVERFLOW");
 return base.toFixed(4);
}
/** Commercial rates use the existing two-decimal money precision; stock cost is allocated from the actual line amount. */
export function rateInSelectedUnits(baseRate:string,selection:ItemUnitSelection,secondaryUnitsPerBase?:string){
 let rate:Prisma.Decimal;
 try{rate=new Exact(baseRate)}catch{throw new Error("INVALID_AMOUNT")}
 if(!rate.isFinite()||rate.lt(0))throw new Error("INVALID_AMOUNT");
 const selected=selection==="SECONDARY"?rate.div(factor(secondaryUnitsPerBase)):rate;
 const rounded=selected.toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);
 if(rounded.gte("10000000000000000"))throw new Error("UNIT_CONVERSION_OVERFLOW");
 return rounded.toFixed(2);
}
