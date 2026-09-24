import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {requirePermission,requirePermissionForMutation} from "@/lib/auth/authorization";
import {createBillingOrder,createMobileBillingOrder,quoteBillingOrder,confirmManualPayment} from "./service";
import {prorateToExpiry} from "./math";
import {TELECALLER_PRICE_SCHEDULE_INR,type TelecallerBillingPeriod} from "./sales-pricing";
import {getTelecallerBillingOverviewForCompany} from "./telecaller";

export type SalesTeamPurchaseMode="ADD_TEAM"|"RENEW"|"NEW";

type UnifiedInput={
 billingPeriod:"SIX_MONTH"|"YEARLY";
 adminSeats:number;
 managerSeats:number;
 salesSeats:number;
 telecallerSeats?:number;
 accountPackages?:number;
 retainAdminUserIds?:string[];
 retainManagerUserIds?:string[];
 retainSalesUserIds?:string[];
 idempotencyKey:string;
 purchaseMode?:SalesTeamPurchaseMode;
};

type RawUnifiedOrder={companyId:string;telecallerSeats:number;telecallerSubtotal:Prisma.Decimal;telecallerIncluded:boolean;billingPeriod:TelecallerBillingPeriod};

const normalInput=(input:UnifiedInput)=>({billingPeriod:input.billingPeriod,adminSeats:input.adminSeats,managerSeats:input.managerSeats,salesSeats:input.salesSeats,accountPackages:input.accountPackages??0,retainAdminUserIds:input.retainAdminUserIds??[],retainManagerUserIds:input.retainManagerUserIds??[],retainSalesUserIds:input.retainSalesUserIds??[],idempotencyKey:input.idempotencyKey});
const safeTelecallerSeats=(value:unknown)=>{const n=Number(value??0);if(!Number.isInteger(n)||n<0||n>10000)throw new Error("INVALID_TELECALLER_SEATS");return n};

async function currentSalesTerm(companyId:string,now=new Date()){
 return db.companySubscription.findFirst({where:{companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now},OR:[{adminSeats:{gt:0}},{managerSeats:{gt:0}},{salesSeats:{gt:0}}]},orderBy:{endsAt:"desc"},select:{billingPeriod:true,startsAt:true,endsAt:true}});
}

export async function reconcileTelecallerToSalesTerm(companyId:string){
 const term=await currentSalesTerm(companyId);if(!term)return null;
 await db.$executeRaw(Prisma.sql`UPDATE "telecaller_subscriptions" SET "endsAt"=${term.endsAt},"billingPeriod"=${term.billingPeriod},"updatedAt"=NOW() WHERE "companyId"=${companyId}::uuid AND status='ACTIVE' AND "startsAt"<=NOW() AND "endsAt">${term.endsAt}`);
 return term;
}

export async function quoteTelecallerSeats(companyId:string,targetSeats:number,period:TelecallerBillingPeriod,mode:SalesTeamPurchaseMode){
 targetSeats=safeTelecallerSeats(targetSeats);await reconcileTelecallerToSalesTerm(companyId);
 const overview=await getTelecallerBillingOverviewForCompany(companyId);if(targetSeats<overview.used)throw new Error("TELECALLER_SEATS_BELOW_USAGE");
 const unit=new Prisma.Decimal(TELECALLER_PRICE_SCHEDULE_INR[period]);
 if(mode==="ADD_TEAM"){
  const term=await currentSalesTerm(companyId);if(!term)throw new Error("ACTIVE_SALES_SUBSCRIPTION_REQUIRED");if(term.billingPeriod!==period)throw new Error("BILLING_PERIOD_MISMATCH");if(targetSeats<overview.limit)throw new Error("ADD_TEAM_CANNOT_REDUCE_TELECALLERS");
  const added=Math.max(0,targetSeats-overview.limit),full=unit.mul(added),subtotal=prorateToExpiry(full,new Date(),term.startsAt,term.endsAt);
  return{targetSeats,currentSeats:overview.limit,addedSeats:added,unitPrice:unit,subtotal,prorated:added>0,coTermEndsAt:term.endsAt};
 }
 return{targetSeats,currentSeats:overview.limit,addedSeats:Math.max(0,targetSeats-overview.limit),unitPrice:unit,subtotal:unit.mul(targetSeats),prorated:false,coTermEndsAt:null as Date|null};
}

export async function quoteUnifiedSalesTeamOrder(input:UnifiedInput){
 const actor=await requirePermission("SALES_BILLING");if(!actor.companyId)throw new Error("NOT_AUTHORIZED");
 const mode=input.purchaseMode??"NEW",telecallerSeats=safeTelecallerSeats(input.telecallerSeats),normal=await quoteBillingOrder(normalInput(input)),tele=await quoteTelecallerSeats(actor.companyId,telecallerSeats,input.billingPeriod,mode);
 return{...normal,telecallerSeats,telecallerSubtotal:tele.subtotal,subtotal:normal.subtotal.plus(tele.subtotal),prorated:normal.prorated||tele.prorated,coTermEndsAt:normal.coTermEndsAt??tele.coTermEndsAt};
}

async function augmentOrder(orderId:string,companyId:string,telecallerSeats:number,period:TelecallerBillingPeriod,mode:SalesTeamPurchaseMode){
 const tele=await quoteTelecallerSeats(companyId,telecallerSeats,period,mode);
 const prior=await db.$queryRaw<{telecallerSubtotal:Prisma.Decimal}[]>(Prisma.sql`SELECT "telecallerSubtotal" FROM "billing_orders" WHERE id=${orderId}::uuid AND "companyId"=${companyId}::uuid`),previous=new Prisma.Decimal(prior[0]?.telecallerSubtotal??0);
 await db.$executeRaw(Prisma.sql`UPDATE "billing_orders" SET "telecallerSeats"=${telecallerSeats},"telecallerSubtotal"=${tele.subtotal},"telecallerIncluded"=TRUE,subtotal=subtotal-${previous}+${tele.subtotal},"totalAmount"="totalAmount"-${previous}+${tele.subtotal},"updatedAt"=NOW() WHERE id=${orderId}::uuid AND "companyId"=${companyId}::uuid`);
 await db.billingAuditEvent.create({data:{companyId,type:"SEATS_CHANGED",entityId:orderId,reason:"Unified Sales team order includes Telecaller seats",metadata:{kind:"UNIFIED_SALES_TEAM",purchaseMode:mode,telecallerSeats,telecallerSubtotal:tele.subtotal.toFixed(2),coTermEndsAt:tele.coTermEndsAt?.toISOString()??null}}});
}

export async function createUnifiedSalesTeamOrder(input:UnifiedInput){
 const actor=await requirePermissionForMutation("SALES_BILLING");if(!actor.companyId)throw new Error("NOT_AUTHORIZED");const mode=input.purchaseMode??"NEW",telecallerSeats=safeTelecallerSeats(input.telecallerSeats);
 const order=await createBillingOrder(normalInput(input));await augmentOrder(order.id,actor.companyId,telecallerSeats,input.billingPeriod,mode);return db.billingOrder.findUniqueOrThrow({where:{id:order.id}});
}

export async function createUnifiedMobileSalesTeamOrder(actor:{id:string;companyId:string},input:UnifiedInput){
 const mode=input.purchaseMode??"NEW",telecallerSeats=safeTelecallerSeats(input.telecallerSeats),order=await createMobileBillingOrder(actor,normalInput(input));await augmentOrder(order.id,actor.companyId,telecallerSeats,input.billingPeriod,mode);return db.billingOrder.findUniqueOrThrow({where:{id:order.id}});
}

async function unifiedOrder(orderId:string){
 const rows=await db.$queryRaw<RawUnifiedOrder[]>(Prisma.sql`SELECT "companyId","telecallerSeats","telecallerSubtotal","telecallerIncluded","billingPeriod" FROM "billing_orders" WHERE id=${orderId}::uuid`);return rows[0]??null;
}

async function syncTelecallerEntitlement(orderId:string){
 const order=await unifiedOrder(orderId);if(!order?.telecallerIncluded)return;
 const now=new Date();
 const sourceTerm=await db.companySubscription.findFirst({where:{companyId:order.companyId,sourceOrderId:orderId,status:"ACTIVE"},select:{billingPeriod:true,startsAt:true,endsAt:true}});
 const term=sourceTerm??await currentSalesTerm(order.companyId,now);if(!term)throw new Error("ACTIVE_SALES_SUBSCRIPTION_REQUIRED");
 await db.$executeRaw(Prisma.sql`UPDATE "telecaller_subscriptions" SET "endsAt"=${term.endsAt},"billingPeriod"=${term.billingPeriod},"updatedAt"=NOW() WHERE "companyId"=${order.companyId}::uuid AND status='ACTIVE' AND "startsAt"<=${now} AND "endsAt">${term.endsAt}`);
 const exact=await db.$queryRaw<{id:string}[]>(Prisma.sql`SELECT id FROM "telecaller_subscriptions" WHERE "companyId"=${order.companyId}::uuid AND status='ACTIVE' AND ABS(EXTRACT(EPOCH FROM ("startsAt"-${term.startsAt})))<2 AND ABS(EXTRACT(EPOCH FROM ("endsAt"-${term.endsAt})))<2 LIMIT 1`);
 if(order.telecallerSeats===0){if(exact[0])await db.$executeRaw(Prisma.sql`UPDATE "telecaller_subscriptions" SET status='CANCELLED',"updatedAt"=NOW() WHERE id=${exact[0].id}::uuid`);return;}
 if(exact[0])await db.$executeRaw(Prisma.sql`UPDATE "telecaller_subscriptions" SET seats=${order.telecallerSeats},"billingPeriod"=${term.billingPeriod},"updatedAt"=NOW() WHERE id=${exact[0].id}::uuid`);
 else{const id=crypto.randomUUID();await db.$executeRaw(Prisma.sql`INSERT INTO "telecaller_subscriptions" (id,"companyId",status,"billingPeriod",seats,"startsAt","endsAt","sourceOrderId","createdAt","updatedAt") VALUES (${id}::uuid,${order.companyId}::uuid,'ACTIVE',${term.billingPeriod},${order.telecallerSeats},${term.startsAt},${term.endsAt},NULL,NOW(),NOW())`);}
}

export async function confirmUnifiedManualPayment(orderId:string,reference:string){const result=await confirmManualPayment(orderId,reference);await syncTelecallerEntitlement(orderId);return result;}

export async function unifiedTelecallerOrderFields(orderIds:string[]){
 if(!orderIds.length)return new Map<string,{telecallerSeats:number;telecallerSubtotal:string;telecallerIncluded:boolean}>();
 const rows=await db.$queryRaw<{id:string;telecallerSeats:number;telecallerSubtotal:Prisma.Decimal;telecallerIncluded:boolean}[]>(Prisma.sql`SELECT id,"telecallerSeats","telecallerSubtotal","telecallerIncluded" FROM "billing_orders" WHERE id IN (${Prisma.join(orderIds.map(id=>Prisma.sql`${id}::uuid`))})`);
 return new Map(rows.map(r=>[r.id,{telecallerSeats:r.telecallerSeats,telecallerSubtotal:r.telecallerSubtotal.toFixed(2),telecallerIncluded:r.telecallerIncluded}]));
}
