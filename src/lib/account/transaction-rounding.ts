import {Prisma} from "@prisma/client";
export function transactionRoundingLimit(raw:unknown){
 const defaults=(raw??{}) as Record<string,unknown>,preferences=(defaults.transactionPreferences??{}) as Record<string,unknown>,step=Number(preferences.roundingStep??1);
 return preferences.roundOff===true&&Number.isFinite(step)&&step>0&&step<=100?Math.max(10,step/2):10;
}
export function defaultTransactionRoundOff(amount:Prisma.Decimal,raw:unknown){
 const defaults=(raw??{}) as Record<string,unknown>,preferences=(defaults.transactionPreferences??{}) as Record<string,unknown>,step=Number(preferences.roundingStep??1);
 if(preferences.roundOff!==true||!Number.isFinite(step)||step<=0||step>100)return new Prisma.Decimal(0);
 return amount.div(step).toDecimalPlaces(0,Prisma.Decimal.ROUND_HALF_UP).mul(step).sub(amount).toDecimalPlaces(2);
}
