import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {requirePermission,requirePermissionForMutation,requireRole} from "@/lib/auth/authorization";
import {calculateOrder,addBillingPeriod,renewalWindow} from "./math";
import {orderRequestSchema,priceChangeSchema,overrideSchema} from "./validation";
import type {VerifiedPayment} from "./provider";
import {effectiveEntitlement} from "./entitlement";
import {assertManagerSeatsAllowed} from "./policy";
import {applyDueSeatReductions} from "./seat-reduction";
import {lockBillingCompany} from "./company-lock";

const billingUser=async(mutation=false)=>{const u=mutation?await requirePermissionForMutation("SALES_BILLING"):await requirePermission("SALES_BILLING");if(!u.companyId)throw new Error("NOT_AUTHORIZED");return{...u,companyId:u.companyId}};

export async function currentPrices(){
 return db.billingPrice.findMany({where:{effectiveUntil:null,currency:"INR"},orderBy:[{role:"asc"},{period:"asc"}]});
}

export async function changePrice(raw:unknown){
 const u=await requireRole("SUPER_ADMIN"),d=priceChangeSchema.parse(raw),now=new Date();
 return db.$transaction(async tx=>{
  await tx.billingPrice.updateMany({where:{role:d.role,period:d.period,currency:d.currency,effectiveUntil:null},data:{effectiveUntil:now}});
  const p=await tx.billingPrice.create({data:{...d,amount:new Prisma.Decimal(d.amount),effectiveFrom:now,createdByUserId:u.id}});
  await tx.billingAuditEvent.create({data:{actorUserId:u.id,type:"PRICING_CHANGED",entityId:p.id,metadata:{role:d.role,period:d.period,currency:d.currency}}});
  return p;
 });
}

async function validatedRetainedUsers(companyId:string,role:"ADMIN"|"MANAGER"|"SALES",newSeats:number,currentUsage:number,ids:string[],isRenewal:boolean){
 if(newSeats>=currentUsage){
  if(ids.length)throw new Error("INVALID_SEAT_SELECTION");
  return [] as string[];
 }
 if(!isRenewal)throw new Error("SEATS_BELOW_USAGE");
 if(ids.length!==newSeats||new Set(ids).size!==ids.length)throw new Error("SEAT_SELECTION_REQUIRED");
 if(!ids.length)return [];
 const count=await db.user.count({where:{companyId,salesRole:role,isActive:true,salesAccessActive:true,id:{in:ids}}});
 if(count!==ids.length)throw new Error("INVALID_SEAT_SELECTION");
 return ids;
}

export async function createBillingOrder(raw:unknown){
 const u=await billingUser(true),d=orderRequestSchema.parse(raw);
 const existing=await db.billingOrder.findUnique({where:{idempotencyKey:d.idempotencyKey}});
 if(existing){if(existing.companyId!==u.companyId)throw new Error("NOT_FOUND");return existing}
 const company=await db.company.findUnique({where:{id:u.companyId},select:{teamStructure:true}});
 if(!company)throw new Error("NOT_FOUND");
 assertManagerSeatsAllowed(company.teamStructure,d.managerSeats);
 const e=await effectiveEntitlement(u.companyId);
 const retainAdminUserIds=await validatedRetainedUsers(u.companyId,"ADMIN",d.adminSeats,e.adminUsage,d.retainAdminUserIds,e.paidActive);
 const retainManagerUserIds=await validatedRetainedUsers(u.companyId,"MANAGER",d.managerSeats,e.managerUsage,d.retainManagerUserIds,e.paidActive);
 const retainSalesUserIds=await validatedRetainedUsers(u.companyId,"SALES",d.salesSeats,e.salesUsage,d.retainSalesUserIds,e.paidActive);
 const prices=await currentPrices(),ap=prices.find(p=>p.role==="ADMIN"&&p.period===d.billingPeriod),mp=prices.find(p=>p.role==="MANAGER"&&p.period===d.billingPeriod),sp=prices.find(p=>p.role==="SALES"&&p.period===d.billingPeriod);
 if(!ap||!mp||!sp||ap.currency!==mp.currency||mp.currency!==sp.currency)throw new Error("PRICING_UNAVAILABLE");
 const money=calculateOrder(d.adminSeats,d.managerSeats,d.salesSeats,ap.amount,mp.amount,sp.amount);
 return db.$transaction(async tx=>{
  const o=await tx.billingOrder.create({data:{companyId:u.companyId,createdByUserId:u.id,billingPeriod:d.billingPeriod,adminSeats:d.adminSeats,managerSeats:d.managerSeats,salesSeats:d.salesSeats,retainAdminUserIds,retainManagerUserIds,retainSalesUserIds,adminUnitPrice:ap.amount,managerUnitPrice:mp.amount,salesUnitPrice:sp.amount,currency:"INR",...money,provider:"UNCONFIGURED",idempotencyKey:d.idempotencyKey,expiresAt:new Date(Date.now()+86400000)}});
  await tx.billingAuditEvent.create({data:{companyId:u.companyId,actorUserId:u.id,type:"ORDER_CREATED",entityId:o.id,metadata:{period:d.billingPeriod,adminSeats:d.adminSeats,managerSeats:d.managerSeats,salesSeats:d.salesSeats,retainAdminUserIds,retainManagerUserIds,retainSalesUserIds}}});
  return o;
 });
}

export async function activateVerifiedPayment(v:VerifiedPayment){
 const result=await db.$transaction(async tx=>{
  const prior=await tx.paymentTransaction.findUnique({where:{providerPaymentId:v.providerPaymentId}});
  if(prior)return{payment:prior,companyId:prior.companyId};
  // This first read resolves only the tenant lock key. Nothing mutable is trusted from it.
  const orderTenant=await tx.billingOrder.findUnique({where:{id:v.orderId},select:{companyId:true}});
  if(!orderTenant)throw new Error("PAYMENT_MISMATCH");
  await lockBillingCompany(tx,orderTenant.companyId);
  await tx.$queryRaw`SELECT 1::int AS "locked" FROM "billing_orders" WHERE "id"=${v.orderId}::uuid AND "companyId"=${orderTenant.companyId}::uuid FOR UPDATE`;
  // Authoritative read occurs after the company and order locks and rechecks every payment invariant.
  const order=await tx.billingOrder.findUnique({where:{id:v.orderId}});
  if(!order||order.companyId!==orderTenant.companyId||order.status!=="PENDING"||order.totalAmount.toFixed(2)!==new Prisma.Decimal(v.amount).toFixed(2)||order.currency!==v.currency)throw new Error("PAYMENT_MISMATCH");
  const current=await tx.companySubscription.findFirst({where:{companyId:order.companyId,status:"ACTIVE",startsAt:{lte:v.capturedAt},endsAt:{gt:v.capturedAt}},orderBy:{endsAt:"desc"}});
  const start=renewalWindow(v.capturedAt,current?.endsAt??null),end=addBillingPeriod(start,order.billingPeriod);
  const payment=await tx.paymentTransaction.create({data:{companyId:order.companyId,orderId:order.id,provider:v.provider,providerPaymentId:v.providerPaymentId,amount:order.totalAmount,currency:order.currency,status:"CAPTURED",capturedAt:v.capturedAt}});
  await tx.billingOrder.update({where:{id:order.id},data:{status:"PAID",paidAt:v.capturedAt}});
  const sub=await tx.companySubscription.create({data:{companyId:order.companyId,status:"ACTIVE",billingPeriod:order.billingPeriod,adminSeats:order.adminSeats,managerSeats:order.managerSeats,salesSeats:order.salesSeats,startsAt:start,endsAt:end,sourceOrderId:order.id}});
  await tx.company.update({where:{id:order.companyId},data:{subscriptionStatus:"ACTIVE"}});
  await tx.billingAuditEvent.createMany({data:[{companyId:order.companyId,type:"PAYMENT_CAPTURED",entityId:payment.id},{companyId:order.companyId,type:current?"SUBSCRIPTION_RENEWED":"SUBSCRIPTION_ACTIVATED",entityId:sub.id}]});
  return{payment,companyId:order.companyId};
 });
 await applyDueSeatReductions(result.companyId,v.capturedAt);
 return result.payment;
}

export async function billingDashboard(){
 const u=await billingUser();
 const entitlement=await effectiveEntitlement(u.companyId);
 const [company,prices,orders,activeEmployees]=await Promise.all([
  db.company.findUnique({where:{id:u.companyId},select:{name:true,subscriptionStatus:true,trialEndsAt:true,teamStructure:true}}),
  currentPrices(),
  db.billingOrder.findMany({where:{companyId:u.companyId},include:{payments:true},orderBy:{createdAt:"desc"},take:50}),
  db.user.findMany({where:{companyId:u.companyId,isActive:true,salesAccessActive:true,salesRole:{in:["ADMIN","MANAGER","SALES"]}},select:{id:true,name:true,salesRole:true,managerType:true},orderBy:[{role:"asc"},{name:"asc"}]})
 ]);
 return{company,entitlement,prices,orders,activeEmployees};
}

export async function platformBilling(){
 await requireRole("SUPER_ADMIN");
 return{prices:await currentPrices(),companies:await db.company.findMany({select:{id:true,name:true,subscriptionStatus:true,trialStartedAt:true,trialEndsAt:true,subscriptions:{orderBy:{endsAt:"desc"},take:1},_count:{select:{users:true,billingOrders:true,payments:true}}},orderBy:{name:"asc"},take:500})};
}

export async function manualOverride(raw:unknown){
 const u=await requireRole("SUPER_ADMIN"),d=overrideSchema.parse(raw),now=new Date(),end=new Date(d.endsAt);
 return db.$transaction(async tx=>{
  await lockBillingCompany(tx,d.companyId);
  const usage=await tx.user.groupBy({by:["salesRole"],where:{companyId:d.companyId,isActive:true,salesAccessActive:true,salesRole:{in:["ADMIN","MANAGER","SALES"]}},_count:true});
  const a=usage.find(x=>x.salesRole==="ADMIN")?._count??0,m=usage.find(x=>x.salesRole==="MANAGER")?._count??0,s=usage.find(x=>x.salesRole==="SALES")?._count??0;
  if(d.adminSeats<a||d.managerSeats<m||d.salesSeats<s)throw new Error("SEATS_BELOW_USAGE");
  const sub=await tx.companySubscription.create({data:{companyId:d.companyId,status:d.status,billingPeriod:d.billingPeriod,adminSeats:d.adminSeats,managerSeats:d.managerSeats,salesSeats:d.salesSeats,startsAt:now,endsAt:end}});
  await tx.company.update({where:{id:d.companyId},data:{subscriptionStatus:d.status==="ACTIVE"?"ACTIVE":"SUSPENDED"}});
  await tx.billingAuditEvent.create({data:{companyId:d.companyId,actorUserId:u.id,type:"SUPER_ADMIN_OVERRIDE",entityId:sub.id,reason:d.reason}});
  return sub;
 });
}
