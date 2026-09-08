import {db} from "@/lib/db";
import {suspendSalesAccessInTransaction} from "@/lib/auth/lifecycle";
import {lockBillingCompany} from "./company-lock";

export async function applyDueSeatReductions(companyId:string,now=new Date()){
 await db.$transaction(async tx=>{
  await lockBillingCompany(tx,companyId);
  const sub=await tx.companySubscription.findFirst({where:{companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now},sourceOrderId:{not:null}},orderBy:{endsAt:"desc"},select:{id:true,sourceOrderId:true}});
  if(!sub?.sourceOrderId)return;
  await tx.$queryRaw`SELECT 1::int AS "locked" FROM "billing_orders" WHERE "id"=${sub.sourceOrderId}::uuid AND "companyId"=${companyId}::uuid FOR UPDATE`;
  const order=await tx.billingOrder.findFirst({where:{id:sub.sourceOrderId,companyId},select:{seatReductionAppliedAt:true,retainAdminUserIds:true,retainManagerUserIds:true,retainSalesUserIds:true,adminSeats:true,managerSeats:true,salesSeats:true}});
  if(!order||order.seatReductionAppliedAt)return;
  const active=await tx.user.findMany({where:{companyId,isActive:true,salesAccessActive:true,salesRole:{in:["ADMIN","MANAGER","SALES"]}},select:{id:true,salesRole:true}});
  const suspendedUserIds:string[]=[];const byRole=[{role:"ADMIN",limit:order.adminSeats,retain:order.retainAdminUserIds},{role:"MANAGER",limit:order.managerSeats,retain:order.retainManagerUserIds},{role:"SALES",limit:order.salesSeats,retain:order.retainSalesUserIds}] as const;
  for(const item of byRole){const users=active.filter(u=>u.salesRole===item.role);if(users.length>item.limit){if(item.retain.length!==item.limit)throw new Error("SEAT_REDUCTION_SELECTION_REQUIRED");const kept=new Set(item.retain);for(const u of users)if(!kept.has(u.id))suspendedUserIds.push(u.id)}}
  for(const userId of suspendedUserIds.sort())await suspendSalesAccessInTransaction(tx,userId);
  await tx.billingOrder.update({where:{id:sub.sourceOrderId},data:{seatReductionAppliedAt:now}});
  await tx.billingAuditEvent.create({data:{companyId,type:"SEATS_CHANGED",entityId:sub.id,metadata:{reason:"PAID_RENEWAL_SALES_SEAT_REDUCTION",adminSeats:order.adminSeats,managerSeats:order.managerSeats,salesSeats:order.salesSeats,suspendedSalesUserIds:suspendedUserIds}}});
 });
}
