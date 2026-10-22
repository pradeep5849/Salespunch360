import {Prisma} from "@prisma/client";
import {z} from "zod";
const amount=z.string().regex(/^\d{1,16}(\.\d{1,2})?$/);
const optional=(value:unknown)=>value===""||value==null?undefined:value;
export const openingFeeInputShape={
 openingFeeAmount:z.preprocess(optional,amount.optional()),
 openingFeeMode:z.preprocess(optional,z.enum(["DEDUCTED","SEPARATE"]).optional()),
 openingFeeAccountId:z.preprocess(optional,z.string().uuid().optional()),
};
export type LoanOpeningFeeInput={principal:string|Prisma.Decimal;openingFeeAmount?:string;openingFeeMode?:"DEDUCTED"|"SEPARATE";openingFeeAccountId?:string};
/** Principal is always gross borrowing; a fee never increases the liability. */
export function loanOpeningFeePlan(d:LoanOpeningFeeInput){
 const fee=new Prisma.Decimal(d.openingFeeAmount??0),principal=new Prisma.Decimal(d.principal);
 if(fee.isZero())return null;
 if(!d.openingFeeMode)throw new Error("OPENING_FEE_MODE_REQUIRED");
 if(d.openingFeeMode==="DEDUCTED"&&fee.gt(principal))throw new Error("OPENING_FEE_EXCEEDS_PRINCIPAL");
 if(d.openingFeeMode==="SEPARATE"&&!d.openingFeeAccountId)throw new Error("OPENING_FEE_ACCOUNT_REQUIRED");
 return{amount:fee.toFixed(2),mode:d.openingFeeMode,moneyAccountId:d.openingFeeMode==="SEPARATE"?d.openingFeeAccountId!:null,grossPrincipal:principal.toFixed(2),netReceipt:(d.openingFeeMode==="DEDUCTED"?principal.sub(fee):principal).toFixed(2)};
}
