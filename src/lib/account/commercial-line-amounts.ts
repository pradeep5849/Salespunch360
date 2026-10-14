import {Prisma} from "@prisma/client";
/** Shared entered-price rounding, before tax decomposition. */
export function commercialLineAmounts(quantity:Prisma.Decimal,rate:Prisma.Decimal,discountType:string|null|undefined,discountValue:Prisma.Decimal){
 if(quantity.lte(0)||rate.lt(0)||discountValue.lt(0))throw new Error("INVALID_AMOUNT");
 const baseAmount=quantity.mul(rate).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);
 const discountAmount=(discountType==="PERCENTAGE"?baseAmount.mul(discountValue).div(100):discountValue).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);
 if(discountAmount.gt(baseAmount)||(discountType==="PERCENTAGE"&&discountValue.gt(100)))throw new Error("INVALID_DISCOUNT");
 return {baseAmount,discountAmount,enteredAmount:baseAmount.sub(discountAmount)};
}
