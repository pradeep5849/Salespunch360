import {db} from "@/lib/db";
import {suspendSalesAccessInTransaction} from "@/lib/auth/lifecycle";

export async function applyDueSeatReductions(companyId:string,now=new Date()){
 const sub=await db.companySubscription.findFirst({where:{companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now},sourceOrderId:{not:null}},orderBy:{endsAt:"desc"},include:{sourceOrder:{select:{id:true,adminSeats:true,managerSeats:true,salesSeats:true,retainAdminUserIds:true,retainManagerUserIds:true,retainSalesUserIds:true,seatReductionAppliedAt:true}}}});
 const order=sub?.sourceOrder;if(!sub||!order||order.seatReductionAppliedAt)return;
 await db.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT "id" FROM "billing_orders" WHERE "id"=$1::uuid FOR UPDATE',order.id);
  const fresh=await tx.billingOrder.findUnique({where:{id:order.id},select:{seatReductionAppliedAt:true,retainAdminUserIds:true,retainManagerUserIds:true,retainSalesUserIds:true,adminSeats:true,managerSeats:true,salesSeats:true}});if(!fresh||fresh.seatReductionAppliedAt)return;
  const active=await tx.user.findMany({where:{companyId,isActive:true,salesAccessActive:true,salesRole:{in:["ADMIN","MANAGER","SALES"]}},select:{id:true,salesRole:true}});
  const suspendedUserIds:string[]=[];const byRole=[{role:"ADMIN",limit:fresh.adminSeats,retain:fresh.retainAdminUserIds},{role:"MANAGER",limit:fresh.managerSeats,retain:fresh.retainManagerUserIds},{role:"SALES",limit:fresh.salesSeats,retain:fresh.retainSalesUserIds}] as const;
  for(const item of byRole){const users=active.filter(u=>u.salesRole===item.role);if(users.length>item.limit){if(item.retain.length!==item.limit)throw new Error("SEAT_REDUCTION_SELECTION_REQUIRED");const kept=new Set(item.retain);for(const u of users)if(!kept.has(u.id))suspendedUserIds.push(u.id)}}
  for(const userId of suspendedUserIds.sort())await suspendSalesAccessInTransaction(tx,userId);
  await tx.billingOrder.update({where:{id:order.id},data:{seatReductionAppliedAt:now}});
  await tx.billingAuditEvent.create({data:{companyId,type:"SEATS_CHANGED",entityId:sub.id,metadata:{reason:"PAID_RENEWAL_SALES_SEAT_REDUCTION",adminSeats:fresh.adminSeats,managerSeats:fresh.managerSeats,salesSeats:fresh.salesSeats,suspendedSalesUserIds:suspendedUserIds}}});
 });
}
