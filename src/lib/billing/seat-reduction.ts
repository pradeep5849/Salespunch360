import {db} from "@/lib/db";
import {deactivateIdentityInTransaction} from "@/lib/auth/lifecycle";

export async function applyDueSeatReductions(companyId:string,now=new Date()){
 const sub=await db.companySubscription.findFirst({
  where:{companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now},sourceOrderId:{not:null}},
  orderBy:{endsAt:"desc"},
  include:{sourceOrder:{select:{id:true,managerSeats:true,salesSeats:true,retainManagerUserIds:true,retainSalesUserIds:true,seatReductionAppliedAt:true}}}
 });
 const order=sub?.sourceOrder;
 if(!sub||!order||order.seatReductionAppliedAt)return;

 await db.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT "id" FROM "billing_orders" WHERE "id"=$1::uuid FOR UPDATE',order.id);
  const fresh=await tx.billingOrder.findUnique({where:{id:order.id},select:{seatReductionAppliedAt:true,retainManagerUserIds:true,retainSalesUserIds:true,managerSeats:true,salesSeats:true}});
  if(!fresh||fresh.seatReductionAppliedAt)return;

  const active=await tx.user.findMany({where:{companyId,isActive:true,role:{in:["MANAGER","SALES"]}},select:{id:true,role:true}});
  const managers=active.filter(u=>u.role==="MANAGER"),sales=active.filter(u=>u.role==="SALES");
  const deactivateIds:string[]=[];

  if(managers.length>fresh.managerSeats){
   if(fresh.retainManagerUserIds.length!==fresh.managerSeats)throw new Error("SEAT_REDUCTION_SELECTION_REQUIRED");
   const allowed=new Set(fresh.retainManagerUserIds);
   for(const u of managers)if(!allowed.has(u.id))deactivateIds.push(u.id);
  }
  if(sales.length>fresh.salesSeats){
   if(fresh.retainSalesUserIds.length!==fresh.salesSeats)throw new Error("SEAT_REDUCTION_SELECTION_REQUIRED");
   const allowed=new Set(fresh.retainSalesUserIds);
   for(const u of sales)if(!allowed.has(u.id))deactivateIds.push(u.id);
  }

  // A stable order prevents two concurrent multi-user security operations from
  // acquiring user locks in opposite orders.
  for(const userId of deactivateIds.sort())await deactivateIdentityInTransaction(tx,userId);
  await tx.billingOrder.update({where:{id:order.id},data:{seatReductionAppliedAt:now}});
  await tx.billingAuditEvent.create({data:{companyId,type:"SEATS_CHANGED",entityId:sub.id,metadata:{managerSeats:fresh.managerSeats,salesSeats:fresh.salesSeats,deactivatedUserIds:deactivateIds}}});
 });
}
