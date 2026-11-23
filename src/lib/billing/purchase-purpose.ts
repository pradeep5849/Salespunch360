import type {Prisma} from '@prisma/client';
import {telecallerBillingState} from './telecaller';
export type PurchasePurpose='RENEWAL'|'ADDITION';
export type PurchaseMode='RENEW'|'ADD_TEAM'|'ADD_ACCOUNT';
type Target={purchaseMode?:PurchaseMode;billingPeriod:string;adminSeats:number;managerSeats:number;salesSeats:number;accountPackages:number;telecallerSeats:number};
type Term={billingPeriod?:string;adminSeats:number;managerSeats:number;salesSeats:number;accountPackages:number;startsAt:Date;endsAt:Date};
export function resolvePurchasePurpose(input:Target,term:Term|null,telecallerLimit:number,now:Date):PurchasePurpose{
 if(input.purchaseMode==='RENEW')return 'RENEWAL';
 const active=term&&term.endsAt>now?term:null;
 if(!active){if(input.purchaseMode)throw new Error('ADDITION_REQUIRES_ACTIVE_TERM');return 'RENEWAL';}
 const keys=['adminSeats','managerSeats','salesSeats','accountPackages'] as const;
 const reduction=keys.some(k=>input[k]<active[k])||input.telecallerSeats<telecallerLimit;
 const salesGrowth=keys.slice(0,3).some(k=>input[k]>active[k])||input.telecallerSeats>telecallerLimit;
 const accountGrowth=input.accountPackages>active.accountPackages;
 const samePeriod=!active.billingPeriod||input.billingPeriod===active.billingPeriod;
 if(input.purchaseMode){
  if(!samePeriod||reduction)throw new Error('INVALID_ADDITION_SELECTION');
  if(input.purchaseMode==='ADD_TEAM'&&(!salesGrowth||input.accountPackages!==active.accountPackages))throw new Error('INVALID_ADDITION_SELECTION');
  if(input.purchaseMode==='ADD_ACCOUNT'&&(!accountGrowth||salesGrowth||input.telecallerSeats!==telecallerLimit||keys.slice(0,3).some(k=>input[k]!==active[k])))throw new Error('INVALID_ADDITION_SELECTION');
  return 'ADDITION';
 }
 // Older clients omit mode: infer an addition only for pure growth in the current period.
 return samePeriod&&!reduction&&(salesGrowth||accountGrowth)?'ADDITION':'RENEWAL';
}
export async function purchasePurposeForCompany(client:Prisma.TransactionClient,companyId:string,input:Target,now:Date,term:Term|null){
 if(input.purchaseMode==='RENEW')return 'RENEWAL' as const;
 const limit=term?(await telecallerBillingState(client,companyId,now)).limit:0;
 return resolvePurchasePurpose(input,term,limit,now);
}
export function recordedPurchasePurpose(metadata:unknown):PurchasePurpose|undefined{
 if(!metadata||typeof metadata!=='object')return;
 const value=metadata as {purchasePurpose?:unknown;prorated?:unknown};
 if(value.purchasePurpose==='RENEWAL'||value.purchasePurpose==='ADDITION')return value.purchasePurpose;
 // Preserve known historical semantics; absent evidence remains ambiguous.
 if(typeof value.prorated==='boolean')return value.prorated?'ADDITION':'RENEWAL';
}
