import {Prisma,type BillingPeriod} from '@prisma/client';
import {ACCOUNT_PACKAGE_SIX_MONTH_PRICE_INR,ACCOUNT_PACKAGE_YEARLY_PRICE_INR} from './account-package';
import {prorateToExpiry} from './math';

export const PLUS_ORDER_PROVIDER='PLUS_COMBINED';
export type CombinedOrderQuote={salesSubtotal:Prisma.Decimal;accountSubtotal:Prisma.Decimal;subtotal:Prisma.Decimal;prorated:boolean;coTermEndsAt:Date|null};
export function quoteCombinedOrder(input:{period:BillingPeriod;adminSeats:number;managerSeats:number;salesSeats:number;accountPackages:number;adminPrice:Prisma.Decimal;managerPrice:Prisma.Decimal;salesPrice:Prisma.Decimal;accountPrice?:Prisma.Decimal;now:Date;currentTerm?:{startsAt:Date;endsAt:Date;adminSeats:number;managerSeats:number;salesSeats:number;accountPackages:number}|null}):CombinedOrderQuote{
 const accountUnit=input.accountPrice??new Prisma.Decimal(input.period==='SIX_MONTH'?ACCOUNT_PACKAGE_SIX_MONTH_PRICE_INR:ACCOUNT_PACKAGE_YEARLY_PRICE_INR),salesFull=input.adminPrice.mul(input.adminSeats).plus(input.managerPrice.mul(input.managerSeats)).plus(input.salesPrice.mul(input.salesSeats)),accountFull=accountUnit.mul(input.accountPackages),term=input.currentTerm;
 if(!term||input.now>=term.endsAt)return{salesSubtotal:salesFull,accountSubtotal:accountFull,subtotal:salesFull.plus(accountFull),prorated:false,coTermEndsAt:null};
 const addedSales=input.adminPrice.mul(Math.max(0,input.adminSeats-term.adminSeats)).plus(input.managerPrice.mul(Math.max(0,input.managerSeats-term.managerSeats))).plus(input.salesPrice.mul(Math.max(0,input.salesSeats-term.salesSeats))),addedAccount=accountUnit.mul(Math.max(0,input.accountPackages-term.accountPackages)),salesSubtotal=prorateToExpiry(addedSales,input.now,term.startsAt,term.endsAt),accountSubtotal=prorateToExpiry(addedAccount,input.now,term.startsAt,term.endsAt);
 return{salesSubtotal,accountSubtotal,subtotal:salesSubtotal.plus(accountSubtotal),prorated:true,coTermEndsAt:term.endsAt};
}
