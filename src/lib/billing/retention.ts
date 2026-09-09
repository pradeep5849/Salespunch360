import type {BillingRole,Prisma} from '@prisma/client';

type SeatSnapshot={
 adminSeats:number;managerSeats:number;salesSeats:number;
 retainAdminUserIds:string[];retainManagerUserIds:string[];retainSalesUserIds:string[];
};

const roles=[
 {role:'ADMIN',seats:'adminSeats',retain:'retainAdminUserIds'},
 {role:'MANAGER',seats:'managerSeats',retain:'retainManagerUserIds'},
 {role:'SALES',seats:'salesSeats',retain:'retainSalesUserIds'},
] as const satisfies readonly {role:BillingRole;seats:keyof SeatSnapshot;retain:keyof SeatSnapshot}[];

export async function hasEffectivePaidSubscription(tx:Prisma.TransactionClient,companyId:string,now:Date){
 return Boolean(await tx.companySubscription.findFirst({where:{companyId,status:'ACTIVE',startsAt:{lte:now},endsAt:{gt:now}},select:{id:true}}));
}

export async function validateAuthoritativeRetention(tx:Prisma.TransactionClient,companyId:string,snapshot:SeatSnapshot,options:{paidRenewal?:boolean;activation?:boolean}={}){
 const usage=await tx.user.groupBy({by:['salesRole'],where:{companyId,isActive:true,salesAccessActive:true,salesRole:{in:['ADMIN','MANAGER','SALES']}},_count:true});
 for(const {role,seats,retain} of roles){
  const limit=snapshot[seats] as number,ids=snapshot[retain] as string[];
  const currentUsage=usage.find(row=>row.salesRole===role)?._count??0;
  if(currentUsage<=limit){if(!options.activation&&ids.length)throw new Error('INVALID_SEAT_SELECTION');continue}
  if(!options.activation&&!options.paidRenewal)throw new Error('SEATS_BELOW_USAGE');
  if(ids.length!==limit||new Set(ids).size!==ids.length)throw new Error(options.activation?'SEAT_REDUCTION_SELECTION_REQUIRED':'SEAT_SELECTION_REQUIRED');
  if(!ids.length)continue;
  const retained=await tx.user.count({where:{companyId,salesRole:role,isActive:true,salesAccessActive:true,id:{in:ids}}});
  if(retained!==ids.length)throw new Error(options.activation?'SEAT_REDUCTION_SELECTION_REQUIRED':'INVALID_SEAT_SELECTION');
 }
}
