import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {requirePermission} from "@/lib/auth/authorization";
import {quoteBillingOrder,createBillingOrder,confirmManualPayment} from "./service";
import {orderRequestSchema} from "./validation";
import {TELECALLER_PRICE_SCHEDULE_INR,type TelecallerBillingPeriod} from "./sales-pricing";
import {telecallerBillingState,syncTelecallerSubscriptionToSalesTerm} from "./telecaller";
import {prorateToExpiry} from "./math";

const TELECALLER_AUDIT_REASON="UNIFIED_TELECALLER_TARGET";

type ParsedTarget={billingPeriod:TelecallerBillingPeriod;telecallerSeats:number};
const parsedTarget=(raw:unknown):ParsedTarget=>{const d=orderRequestSchema.parse(raw);return{billingPeriod:d.billingPeriod,telecallerSeats:d.telecallerSeats}};

export async function telecallerQuoteForCompany(companyId:string,period:TelecallerBillingPeriod,targetSeats:number,now=new Date()){
 const [state,salesTerm]=await Promise.all([
  telecallerBillingState(db,companyId,now),
  db.companySubscription.findFirst({where:{companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now},OR:[{managerSeats:{gt:0}},{salesSeats:{gt:0}}]},select:{startsAt:true,endsAt:true},orderBy:{endsAt:"desc"}}),
 ]);
 const unit=new Prisma.Decimal(TELECALLER_PRICE_SCHEDULE_INR[period]);
 if(!salesTerm)return{currentSeats:state.limit,targetSeats,unitPrice:unit,subtotal:unit.mul(targetSeats),prorated:false,coTermEndsAt:null as Date|null};
 const added=Math.max(0,targetSeats-state.limit),subtotal=prorateToExpiry(unit.mul(added),now,salesTerm.startsAt,salesTerm.endsAt);
 return{currentSeats:state.limit,targetSeats,unitPrice:unit,subtotal,prorated:true,coTermEndsAt:salesTerm.endsAt};
}

export async function quoteUnifiedSalesTeam(raw:unknown){
 const actor=await requirePermission("SALES_BILLING");if(!actor.companyId)throw new Error("NOT_AUTHORIZED");
 const target=parsedTarget(raw),base=await quoteBillingOrder(raw),telecaller=await telecallerQuoteForCompany(actor.companyId,target.billingPeriod,target.telecallerSeats);
 return{...base,telecallerSubtotal:telecaller.subtotal,subtotal:base.subtotal.plus(telecaller.subtotal),prorated:base.prorated||telecaller.prorated,coTermEndsAt:base.coTermEndsAt??telecaller.coTermEndsAt};
}

export async function createUnifiedSalesTeamOrder(raw:unknown){
 const target=parsedTarget(raw),order=await createBillingOrder(raw);
 const existing=await db.billingAuditEvent.findFirst({where:{entityId:order.id,type:"ORDER_CREATED",reason:TELECALLER_AUDIT_REASON},select:{id:true}});
 if(existing)return db.billingOrder.findUniqueOrThrow({where:{id:order.id}});
 const telecaller=await telecallerQuoteForCompany(order.companyId,target.billingPeriod,target.telecallerSeats,order.createdAt);
 return db.$transaction(async tx=>{
  const locked=await tx.billingOrder.findUnique({where:{id:order.id},select:{status:true}});if(!locked)throw new Error("ORDER_NOT_FOUND");
  if(locked.status!=="PENDING")return tx.billingOrder.findUniqueOrThrow({where:{id:order.id}});
  const updated=await tx.billingOrder.update({where:{id:order.id},data:{subtotal:{increment:telecaller.subtotal},totalAmount:{increment:telecaller.subtotal}}});
  await tx.billingAuditEvent.create({data:{companyId:order.companyId,actorUserId:order.createdByUserId,type:"ORDER_CREATED",entityId:order.id,reason:TELECALLER_AUDIT_REASON,metadata:{telecallerSeats:target.telecallerSeats,currentTelecallerSeats:telecaller.currentSeats,telecallerSubtotal:telecaller.subtotal.toFixed(2),telecallerUnitPrice:telecaller.unitPrice.toFixed(2),coTermEndsAt:telecaller.coTermEndsAt?.toISOString()??null}}});
  return updated;
 });
}

function metadataTarget(metadata:Prisma.JsonValue|null):number|null{
 if(!metadata||typeof metadata!=="object"||Array.isArray(metadata))return null;
 const value=(metadata as Prisma.JsonObject).telecallerSeats;
 return typeof value==="number"&&Number.isInteger(value)&&value>=0?value:null;
}

export async function confirmUnifiedManualPayment(orderId:string,reference:string){
 const order=await confirmManualPayment(orderId,reference);
 const marker=await db.billingAuditEvent.findFirst({where:{entityId:order.id,type:"ORDER_CREATED",reason:TELECALLER_AUDIT_REASON},orderBy:{occurredAt:"desc"},select:{metadata:true}}),target=metadataTarget(marker?.metadata??null);
 if(target===null)return order;
 const now=new Date(),termByOrder=await db.companySubscription.findFirst({where:{sourceOrderId:order.id},select:{billingPeriod:true,startsAt:true,endsAt:true}}),term=termByOrder??await db.companySubscription.findFirst({where:{companyId:order.companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now},OR:[{managerSeats:{gt:0}},{salesSeats:{gt:0}}]},select:{billingPeriod:true,startsAt:true,endsAt:true},orderBy:{endsAt:"desc"}});
 if(!term||(term.billingPeriod!=="SIX_MONTH"&&term.billingPeriod!=="YEARLY"))throw new Error("SALES_SUBSCRIPTION_REQUIRED");
 await db.$transaction(tx=>syncTelecallerSubscriptionToSalesTerm(tx,{companyId:order.companyId,seats:target,billingPeriod:term.billingPeriod as TelecallerBillingPeriod,startsAt:term.startsAt,endsAt:term.endsAt}));
 return order;
}

export async function unifiedTelecallerTargetForOrder(orderId:string){
 const marker=await db.billingAuditEvent.findFirst({where:{entityId:orderId,type:"ORDER_CREATED",reason:TELECALLER_AUDIT_REASON},orderBy:{occurredAt:"desc"},select:{metadata:true}});
 return metadataTarget(marker?.metadata??null);
}
