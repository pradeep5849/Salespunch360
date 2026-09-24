import {Prisma,type BillingPeriod} from '@prisma/client';
import {db} from '@/lib/db';
import {addBillingPeriod,prorateToExpiry,renewalWindow} from './math';
import {effectiveCurrentTerm} from './current-term';
import {TELECALLER_PRICE_SCHEDULE_INR} from './sales-pricing';

export type TeamPurchaseMode='ADD_TEAM'|'RENEW'|'NEW';
type TelecallerQuote={targetSeats:number;currentSeats:number;addedSeats:number;unitPrice:Prisma.Decimal;subtotal:Prisma.Decimal;coTermStartsAt:Date;coTermEndsAt:Date;prorated:boolean};

type LegacySubscription={seats:number;startsAt:Date;endsAt:Date};

async function currentSalesTerm(companyId:string,now:Date){
 const active=await db.companySubscription.findMany({where:{companyId,status:'ACTIVE',startsAt:{lte:now},endsAt:{gt:now}},select:{adminSeats:true,managerSeats:true,salesSeats:true,accountPackages:true,startsAt:true,endsAt:true,sourceOrder:{select:{provider:true}}},orderBy:{endsAt:'desc'}});
 return effectiveCurrentTerm(active);
}
async function currentTelecaller(companyId:string,now:Date){
 const rows=await db.$queryRaw<LegacySubscription[]>(Prisma.sql`SELECT seats,"startsAt","endsAt" FROM "telecaller_subscriptions" WHERE "companyId"=${companyId}::uuid AND status='ACTIVE' AND "startsAt"<=${now} AND "endsAt">${now} ORDER BY "endsAt" DESC LIMIT 1`);
 return rows[0]??null;
}
async function telecallerUsage(companyId:string){
 const rows=await db.$queryRaw<{count:bigint}[]>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "users" WHERE "companyId"=${companyId}::uuid AND "isActive"=TRUE AND "salesRole"='SALES'::"SalesRole" AND upper(replace(coalesce(designation,''),' ',''))='TELECALLER'`);
 return Number(rows[0]?.count??0);
}

export async function quoteUnifiedTelecaller(companyId:string,period:BillingPeriod,targetSeats:number,mode:TeamPurchaseMode,now=new Date()):Promise<TelecallerQuote>{
 if(!Number.isInteger(targetSeats)||targetSeats<0||targetSeats>10000)throw new Error('INVALID_INPUT');
 const [term,current,used]=await Promise.all([currentSalesTerm(companyId,now),currentTelecaller(companyId,now),telecallerUsage(companyId)]);
 if(targetSeats<used)throw new Error('TELECALLER_SEATS_BELOW_USAGE');
 const currentSeats=current?.seats??0,unitPrice=new Prisma.Decimal(TELECALLER_PRICE_SCHEDULE_INR[period]);
 if(mode==='ADD_TEAM'){
  if(!term||now>=term.endsAt)throw new Error('SUBSCRIPTION_REQUIRED');
  if(targetSeats<currentSeats)throw new Error('TELECALLER_SEAT_REDUCTION_RENEWAL_ONLY');
  const addedSeats=Math.max(0,targetSeats-currentSeats),subtotal=prorateToExpiry(unitPrice.mul(addedSeats),now,term.startsAt,term.endsAt);
  return{targetSeats,currentSeats,addedSeats,unitPrice,subtotal,coTermStartsAt:now,coTermEndsAt:term.endsAt,prorated:true};
 }
 const start=renewalWindow(now,term?.endsAt??null),end=addBillingPeriod(start,period);
 return{targetSeats,currentSeats,addedSeats:Math.max(0,targetSeats-currentSeats),unitPrice,subtotal:unitPrice.mul(targetSeats),coTermStartsAt:start,coTermEndsAt:end,prorated:false};
}

export async function attachTelecallerToBillingOrder(orderId:string,companyId:string,createdByUserId:string,targetSeats:number,mode:TeamPurchaseMode){
 const order=await db.billingOrder.findFirst({where:{id:orderId,companyId}});if(!order)throw new Error('NOT_FOUND');if(order.status!=='PENDING')return order;
 const quote=await quoteUnifiedTelecaller(companyId,order.billingPeriod,targetSeats,mode);
 const existing=await db.$queryRaw<{subtotal:Prisma.Decimal}[]>(Prisma.sql`SELECT subtotal FROM "telecaller_billing_orders" WHERE id=${order.id}::uuid LIMIT 1`),old=existing[0]?.subtotal??new Prisma.Decimal(0);
 const nextSubtotal=order.subtotal.minus(old).plus(quote.subtotal),nextTotal=order.totalAmount.minus(old).plus(quote.subtotal);
 await db.$transaction(async tx=>{
  await tx.$executeRaw(Prisma.sql`DELETE FROM "telecaller_billing_orders" WHERE id=${order.id}::uuid`);
  await tx.$executeRaw(Prisma.sql`INSERT INTO "telecaller_billing_orders" (id,"companyId","createdByUserId","billingPeriod","addedSeats","targetSeats","unitPrice",subtotal,"totalAmount",status,"paymentReference","coTermStartsAt","coTermEndsAt","expiresAt","createdAt","updatedAt") VALUES (${order.id}::uuid,${companyId}::uuid,${createdByUserId}::uuid,${order.billingPeriod},${quote.addedSeats},${quote.targetSeats},${quote.unitPrice},${quote.subtotal},${quote.subtotal},'PENDING','UNIFIED_SALES_ORDER',${quote.coTermStartsAt},${quote.coTermEndsAt},${order.expiresAt},NOW(),NOW())`);
  await tx.billingOrder.update({where:{id:order.id},data:{subtotal:nextSubtotal,totalAmount:nextTotal}});
 });
 return db.billingOrder.findUniqueOrThrow({where:{id:order.id}});
}

export async function unifiedTelecallerQuoteForDisplay(companyId:string,period:BillingPeriod,targetSeats:number,mode:TeamPurchaseMode){return quoteUnifiedTelecaller(companyId,period,targetSeats,mode)}
