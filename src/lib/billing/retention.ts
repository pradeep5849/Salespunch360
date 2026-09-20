import type {BillingRole,Prisma} from '@prisma/client';
import {ACCOUNT_PACKAGE_ORDER_PROVIDER} from './account-package';

type SeatSnapshot={adminSeats:number;managerSeats:number;salesSeats:number;retainAdminUserIds:string[];retainManagerUserIds:string[];retainSalesUserIds:string[]};
const roles=[{role:'ADMIN',seats:'adminSeats',retain:'retainAdminUserIds'},{role:'MANAGER',seats:'managerSeats',retain:'retainManagerUserIds'},{role:'SALES',seats:'salesSeats',retain:'retainSalesUserIds'}] as const satisfies readonly {role:BillingRole;seats:keyof SeatSnapshot;retain:keyof SeatSnapshot}[];

export function validateRetentionSelection(currentUsage:number,limit:number,ids:string[],allowReduction:boolean,selectionError='SEAT_SELECTION_REQUIRED'){
 if(currentUsage<=limit){if(ids.length)throw new Error('INVALID_SEAT_SELECTION');return}
 if(!allowReduction)throw new Error('SEATS_BELOW_USAGE');
 // Empty means use the existing oldest-active retention fallback when the renewed term starts.
 if(ids.length===0)return;
 if(ids.length!==limit||new Set(ids).size!==ids.length)throw new Error(selectionError);
}

export async function hasEffectivePaidSubscription(tx:Prisma.TransactionClient,companyId:string,now:Date){const subscriptions=await tx.companySubscription.findMany({where:{companyId,status:'ACTIVE',startsAt:{lte:now},endsAt:{gt:now}},select:{sourceOrder:{select:{provider:true}}}});return subscriptions.some(item=>item.sourceOrder?.provider!==ACCOUNT_PACKAGE_ORDER_PROVIDER)}
export async function validateAuthoritativeRetention(tx:Prisma.TransactionClient,companyId:string,snapshot:SeatSnapshot,options:{paidRenewal?:boolean;activation?:boolean}={}){const usage=await tx.user.groupBy({by:['salesRole'],where:{companyId,isActive:true,salesAccessActive:true,salesRole:{in:['ADMIN','MANAGER','SALES']}},_count:true});for(const {role,seats,retain} of roles){const limit=snapshot[seats] as number,ids=snapshot[retain] as string[],currentUsage=usage.find(row=>row.salesRole===role)?._count??0;validateRetentionSelection(currentUsage,limit,ids,Boolean(options.activation||options.paidRenewal),options.activation?'SEAT_REDUCTION_SELECTION_REQUIRED':'SEAT_SELECTION_REQUIRED');if(!ids.length||currentUsage<=limit)continue;const retained=await tx.user.count({where:{companyId,salesRole:role,isActive:true,salesAccessActive:true,id:{in:ids}}});if(retained!==ids.length)throw new Error(options.activation?'SEAT_REDUCTION_SELECTION_REQUIRED':'INVALID_SEAT_SELECTION')}}
