import {PendingOrderConflict} from "./pending-order-intent";
import {recordedPurchasePurpose,type PurchasePurpose} from "./purchase-purpose";
import {Prisma,type BillingOrder} from "@prisma/client";
import {db} from "@/lib/db";
import {requirePermission} from "@/lib/auth/authorization";
import {quoteBillingOrder,createBillingOrder,createMobileBillingOrder,confirmManualPayment} from "./service";
import {orderRequestSchema} from "./validation";
import {TELECALLER_PRICE_SCHEDULE_INR,type TelecallerBillingPeriod} from "./sales-pricing";
import {telecallerBillingState} from "./telecaller";
import {prorateToExpiry} from "./math";

const TELECALLER_AUDIT_REASON="UNIFIED_TELECALLER_TARGET";

type ParsedTarget={billingPeriod:TelecallerBillingPeriod;telecallerSeats:number};
const parsedTarget=(raw:unknown):ParsedTarget=>{const d=orderRequestSchema.parse(raw);return{billingPeriod:d.billingPeriod,telecallerSeats:d.telecallerSeats}};

export async function telecallerQuoteForCompany(companyId:string,period:TelecallerBillingPeriod,targetSeats:number,now=new Date(),client:Prisma.TransactionClient=db,purchasePurpose?:PurchasePurpose){
 const [state,salesTerm]=await Promise.all([
  telecallerBillingState(client,companyId,now),
  client.companySubscription.findFirst({where:{companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now},OR:[{managerSeats:{gt:0}},{salesSeats:{gt:0}}]},select:{startsAt:true,endsAt:true},orderBy:{endsAt:"desc"}}),
 ]);
 if(targetSeats<state.used)throw new Error("TELECALLER_SEATS_BELOW_USAGE");
 const unit=new Prisma.Decimal(TELECALLER_PRICE_SCHEDULE_INR[period]);
 if(purchasePurpose==="RENEWAL"||!salesTerm)return{currentSeats:state.limit,targetSeats,unitPrice:unit,subtotal:unit.mul(targetSeats),prorated:false,coTermEndsAt:null as Date|null};
 const added=Math.max(0,targetSeats-state.limit),subtotal=prorateToExpiry(unit.mul(added),now,salesTerm.startsAt,salesTerm.endsAt);
 return{currentSeats:state.limit,targetSeats,unitPrice:unit,subtotal,prorated:true,coTermEndsAt:salesTerm.endsAt};
}

export async function quoteUnifiedSalesTeam(raw:unknown){
 const actor=await requirePermission("SALES_BILLING");if(!actor.companyId)throw new Error("NOT_AUTHORIZED");
 const target=parsedTarget(raw),base=await quoteBillingOrder(raw),telecaller=await telecallerQuoteForCompany(actor.companyId,target.billingPeriod,target.telecallerSeats,new Date(),db,base.purchasePurpose);
 return{...base,telecallerSubtotal:telecaller.subtotal,subtotal:base.subtotal.plus(telecaller.subtotal),prorated:base.prorated||telecaller.prorated,coTermEndsAt:base.coTermEndsAt??telecaller.coTermEndsAt};
}

/** Caller holds the company billing lock. Base order, amount and marker share this transaction. */
export async function attachTelecallerTargetInTx(tx:Prisma.TransactionClient,order:BillingOrder,target:ParsedTarget){
 await tx.$queryRaw`SELECT id FROM billing_orders WHERE id=${order.id}::uuid AND "companyId"=${order.companyId}::uuid FOR UPDATE`;
 const locked=await tx.billingOrder.findUniqueOrThrow({where:{id:order.id,companyId:order.companyId}});
 const existing=await tx.billingAuditEvent.findFirst({where:{companyId:order.companyId,entityId:order.id,type:"ORDER_CREATED",reason:TELECALLER_AUDIT_REASON},select:{metadata:true}});
 if(existing){if(metadataTarget(existing.metadata)!==target.telecallerSeats)throw new PendingOrderConflict(order.id);return locked;}
 if(locked.status!=="PENDING")return locked;
 const base=await tx.billingAuditEvent.findFirst({where:{companyId:order.companyId,entityId:order.id,type:"ORDER_CREATED",reason:null},select:{metadata:true}});
 const telecaller=await telecallerQuoteForCompany(order.companyId,target.billingPeriod,target.telecallerSeats,order.createdAt,tx,recordedPurchasePurpose(base?.metadata));
 const updated=await tx.billingOrder.update({where:{id:order.id},data:{subtotal:{increment:telecaller.subtotal},totalAmount:{increment:telecaller.subtotal}}});
 await tx.billingAuditEvent.create({data:{companyId:order.companyId,actorUserId:order.createdByUserId,type:"ORDER_CREATED",entityId:order.id,reason:TELECALLER_AUDIT_REASON,metadata:{purchasePurpose:recordedPurchasePurpose(base?.metadata)??null,telecallerSeats:target.telecallerSeats,currentTelecallerSeats:telecaller.currentSeats,telecallerSubtotal:telecaller.subtotal.toFixed(2),telecallerUnitPrice:telecaller.unitPrice.toFixed(2),coTermEndsAt:telecaller.coTermEndsAt?.toISOString()??null}}});
 return updated;
}

export async function createUnifiedSalesTeamOrder(raw:unknown){
 const target=parsedTarget(raw);
 return createBillingOrder(raw,(tx,order)=>attachTelecallerTargetInTx(tx,order,target));
}

export async function createUnifiedMobileSalesTeamOrder(actor:{id:string;companyId:string},raw:unknown){
 const target=parsedTarget(raw);
 return createMobileBillingOrder(actor,raw,(tx,order)=>attachTelecallerTargetInTx(tx,order,target));
}

function metadataTarget(metadata:Prisma.JsonValue|null):number|null{
 if(!metadata||typeof metadata!=="object"||Array.isArray(metadata))return null;
 const value=(metadata as Prisma.JsonObject).telecallerSeats;
 return typeof value==="number"&&Number.isInteger(value)&&value>=0?value:null;
}

export async function confirmUnifiedManualPayment(orderId:string,reference:string){return confirmManualPayment(orderId,reference)}

export async function unifiedTelecallerTargetForOrder(orderId:string){
 const marker=await db.billingAuditEvent.findFirst({where:{entityId:orderId,type:"ORDER_CREATED",reason:TELECALLER_AUDIT_REASON},orderBy:{occurredAt:"desc"},select:{metadata:true}});
 return metadataTarget(marker?.metadata??null);
}
