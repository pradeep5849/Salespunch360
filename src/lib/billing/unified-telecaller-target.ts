import {randomUUID} from "node:crypto";
import {Prisma} from "@prisma/client";
import {syncTelecallerSubscriptionToSalesTerm} from "./telecaller";

/** Paid subscription and its purchased Telecaller seats commit together. */
export async function syncUnifiedTelecallerTargetInTx(tx:Prisma.TransactionClient,orderId:string,companyId:string,now:Date){
 const marker=await tx.billingAuditEvent.findFirst({where:{companyId,entityId:orderId,type:"ORDER_CREATED",reason:"UNIFIED_TELECALLER_TARGET"},orderBy:{occurredAt:"desc"},select:{metadata:true}});
 const metadata=marker?.metadata;
 if(!metadata||typeof metadata!=="object"||Array.isArray(metadata))return;
 const target=metadata.telecallerSeats;
 if(typeof target!=="number"||!Number.isInteger(target)||target<0)throw new Error("INVALID_TELECALLER_TARGET");
 const term=await tx.companySubscription.findFirst({where:{sourceOrderId:orderId},select:{billingPeriod:true,startsAt:true,endsAt:true}})??await tx.companySubscription.findFirst({where:{companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now},OR:[{managerSeats:{gt:0}},{salesSeats:{gt:0}}]},select:{billingPeriod:true,startsAt:true,endsAt:true},orderBy:{endsAt:"desc"}});
 if(!term||(term.billingPeriod!=="SIX_MONTH"&&term.billingPeriod!=="YEARLY"))throw new Error("SALES_SUBSCRIPTION_REQUIRED");
 if(term.startsAt<=now){await syncTelecallerSubscriptionToSalesTerm(tx,{companyId,seats:target,billingPeriod:term.billingPeriod,startsAt:term.startsAt,endsAt:term.endsAt});return}
 const future=await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT id FROM "telecaller_subscriptions" WHERE "companyId"=${companyId}::uuid AND status='ACTIVE' AND "startsAt"=${term.startsAt} AND "endsAt"=${term.endsAt} ORDER BY "createdAt" DESC LIMIT 1`);
 if(target===0){if(future[0])await tx.$executeRaw(Prisma.sql`UPDATE "telecaller_subscriptions" SET status='CANCELLED',"updatedAt"=NOW() WHERE id=${future[0].id}::uuid`);return}
 if(future[0])await tx.$executeRaw(Prisma.sql`UPDATE "telecaller_subscriptions" SET "billingPeriod"=${term.billingPeriod},seats=${target},"updatedAt"=NOW() WHERE id=${future[0].id}::uuid`);
 else await tx.$executeRaw(Prisma.sql`INSERT INTO "telecaller_subscriptions" (id,"companyId",status,"billingPeriod",seats,"startsAt","endsAt","sourceOrderId","createdAt","updatedAt") VALUES (${randomUUID()}::uuid,${companyId}::uuid,'ACTIVE',${term.billingPeriod},${target},${term.startsAt},${term.endsAt},NULL,NOW(),NOW())`);
}
