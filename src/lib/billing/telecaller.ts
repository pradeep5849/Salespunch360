import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireGlobalSuperAdminForMutation, requirePermission, requirePermissionForMutation } from "@/lib/auth/authorization";
import { TELECALLER_PRICE_SCHEDULE_INR, type TelecallerBillingPeriod } from "./sales-pricing";

export const TELECALLER_ORDER_PROVIDER = "TELECALLER_PACKAGE" as const;

type TelecallerSubscriptionRow = {
  id: string;
  companyId: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  billingPeriod: TelecallerBillingPeriod;
  seats: number;
  startsAt: Date;
  endsAt: Date;
  sourceOrderId: string | null;
};

export type TelecallerBillingOrderRow = {
  id: string;
  companyId: string;
  companyName?: string;
  createdByUserId: string;
  createdByName?: string;
  billingPeriod: TelecallerBillingPeriod;
  addedSeats: number;
  targetSeats: number;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED";
  paymentReference: string | null;
  coTermStartsAt: Date;
  coTermEndsAt: Date;
  paidAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
};

const telecallerDesignationSql = Prisma.sql`upper(replace(coalesce(designation,''),' ',''))='TELECALLER'`;

function priceFor(period: TelecallerBillingPeriod) {
  return new Prisma.Decimal(TELECALLER_PRICE_SCHEDULE_INR[period]);
}

async function activeSubscription(tx: Prisma.TransactionClient | typeof db, companyId: string, now = new Date()) {
  const rows = await tx.$queryRaw<TelecallerSubscriptionRow[]>(Prisma.sql`
    SELECT id,"companyId",status,"billingPeriod",seats,"startsAt","endsAt","sourceOrderId"
    FROM "telecaller_subscriptions"
    WHERE "companyId"=${companyId}::uuid AND status='ACTIVE' AND "startsAt"<=${now} AND "endsAt">${now}
    ORDER BY "endsAt" DESC LIMIT 1`);
  return rows[0] ?? null;
}

async function activeSalesTerm(tx: Prisma.TransactionClient | typeof db, companyId:string, now=new Date()){
  const term=await tx.companySubscription.findFirst({where:{companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now},OR:[{managerSeats:{gt:0}},{salesSeats:{gt:0}}]},select:{billingPeriod:true,startsAt:true,endsAt:true},orderBy:{endsAt:"desc"}});
  return term&&term.billingPeriod!=="MONTHLY"?{billingPeriod:term.billingPeriod as TelecallerBillingPeriod,startsAt:term.startsAt,endsAt:term.endsAt}:null;
}

async function activeTelecallerUsage(tx: Prisma.TransactionClient | typeof db, companyId: string, excludeUserId?: string) {
  const rows = await tx.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count FROM "users"
    WHERE "companyId"=${companyId}::uuid AND "isActive"=TRUE AND "salesRole"='SALES'::"SalesRole"
      AND ${telecallerDesignationSql}
      ${excludeUserId ? Prisma.sql`AND id<>${excludeUserId}::uuid` : Prisma.empty}`);
  return Number(rows[0]?.count ?? 0);
}

export async function telecallerBillingState(tx: Prisma.TransactionClient | typeof db, companyId: string, now = new Date()) {
  const [legacy, salesTerm, used] = await Promise.all([
    activeSubscription(tx, companyId, now),
    activeSalesTerm(tx, companyId, now),
    activeTelecallerUsage(tx, companyId),
  ]);
  const subscription=legacy&&salesTerm?{...legacy,billingPeriod:salesTerm.billingPeriod,endsAt:new Date(Math.min(legacy.endsAt.getTime(),salesTerm.endsAt.getTime()))}:null;
  return {subscription, used, limit: subscription?.seats ?? 0, available: Math.max(0, (subscription?.seats ?? 0) - used)};
}

export async function syncTelecallerSubscriptionToSalesTerm(
  tx: Prisma.TransactionClient,
  input: {companyId:string;seats:number;billingPeriod:TelecallerBillingPeriod;startsAt:Date;endsAt:Date},
) {
  await tx.$executeRaw(Prisma.sql`UPDATE "telecaller_subscriptions" SET status='EXPIRED',"updatedAt"=NOW() WHERE "companyId"=${input.companyId}::uuid AND status='ACTIVE' AND "endsAt"<=NOW()`);
  const current = await activeSubscription(tx, input.companyId);
  if (input.seats <= 0) {
    await tx.$executeRaw(Prisma.sql`UPDATE "telecaller_subscriptions" SET status='EXPIRED',"updatedAt"=NOW() WHERE "companyId"=${input.companyId}::uuid AND status='ACTIVE'`);
    return null;
  }
  if (current) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "telecaller_subscriptions"
      SET status='ACTIVE',"billingPeriod"=${input.billingPeriod},seats=${input.seats},"startsAt"=${input.startsAt},"endsAt"=${input.endsAt},"updatedAt"=NOW()
      WHERE id=${current.id}::uuid`);
    return {...current,status:"ACTIVE" as const,billingPeriod:input.billingPeriod,seats:input.seats,startsAt:input.startsAt,endsAt:input.endsAt};
  }
  const subscriptionId=randomUUID();
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "telecaller_subscriptions" (id,"companyId",status,"billingPeriod",seats,"startsAt","endsAt","sourceOrderId","createdAt","updatedAt")
    VALUES (${subscriptionId}::uuid,${input.companyId}::uuid,'ACTIVE',${input.billingPeriod},${input.seats},${input.startsAt},${input.endsAt},NULL,NOW(),NOW())`);
  return {id:subscriptionId,companyId:input.companyId,status:"ACTIVE" as const,billingPeriod:input.billingPeriod,seats:input.seats,startsAt:input.startsAt,endsAt:input.endsAt,sourceOrderId:null};
}

export async function assertActiveTelecallerEntitlement(companyId: string) {
  const state=await telecallerBillingState(db,companyId);
  if (!state.subscription) throw new Error("TELECALLER_SUBSCRIPTION_REQUIRED");
  return state.subscription;
}

export async function assertTelecallerSeatAvailable(companyId: string, excludeUserId?: string) {
  const state=await telecallerBillingState(db,companyId);
  if (!state.subscription) throw new Error("TELECALLER_SUBSCRIPTION_REQUIRED");
  const used = excludeUserId?await activeTelecallerUsage(db, companyId, excludeUserId):state.used;
  if (used >= state.subscription.seats) throw new Error("TELECALLER_SEAT_LIMIT");
  return { subscription:state.subscription, used, available: Math.max(0, state.subscription.seats - used) };
}

export async function getTelecallerBillingOverview() {
  const actor = await requirePermission("SALES_BILLING");
  if (!actor.companyId) throw new Error("NOT_AUTHORIZED");
  return getTelecallerBillingOverviewForCompany(actor.companyId);
}

export async function getTelecallerBillingOverviewForCompany(companyId: string) {
  const now = new Date();
  await db.$executeRaw(Prisma.sql`UPDATE "telecaller_billing_orders" SET status='EXPIRED',"updatedAt"=NOW() WHERE "companyId"=${companyId}::uuid AND status='PENDING' AND "expiresAt" IS NOT NULL AND "expiresAt"<=NOW()`);
  await db.$executeRaw(Prisma.sql`UPDATE "telecaller_subscriptions" SET status='EXPIRED',"updatedAt"=NOW() WHERE "companyId"=${companyId}::uuid AND status='ACTIVE' AND "endsAt"<=NOW()`);
  const [state, orders] = await Promise.all([
    telecallerBillingState(db, companyId, now),
    db.$queryRaw<TelecallerBillingOrderRow[]>(Prisma.sql`
      SELECT id,"companyId","createdByUserId","billingPeriod","addedSeats","targetSeats","unitPrice",subtotal,"totalAmount",status,"paymentReference","coTermStartsAt","coTermEndsAt","paidAt","expiresAt","createdAt"
      FROM "telecaller_billing_orders" WHERE "companyId"=${companyId}::uuid ORDER BY "createdAt" DESC LIMIT 20`),
  ]);
  return {...state, orders, prices: TELECALLER_PRICE_SCHEDULE_INR};
}

export async function createTelecallerBillingOrder(input: { addedSeats: number; billingPeriod: TelecallerBillingPeriod }) {
  const actor = await requirePermissionForMutation("SALES_BILLING");
  const companyId = actor.companyId;
  if (!companyId) throw new Error("NOT_AUTHORIZED");
  if (!Number.isInteger(input.addedSeats) || input.addedSeats < 1 || input.addedSeats > 100) throw new Error("INVALID_SEAT_COUNT");
  if (input.billingPeriod !== "SIX_MONTH" && input.billingPeriod !== "YEARLY") throw new Error("INVALID_BILLING_PERIOD");

  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "companies" WHERE id=${companyId}::uuid FOR UPDATE`;
    const now = new Date();
    const salesTerm = await activeSalesTerm(tx,companyId,now);
    if (!salesTerm) throw new Error("SALES_SUBSCRIPTION_REQUIRED");
    const state=await telecallerBillingState(tx,companyId,now),current=state.subscription;
    const period = salesTerm.billingPeriod;
    const basePrice = priceFor(period);
    const startsAt = now;
    const endsAt = salesTerm.endsAt;
    const fullMs = Math.max(1, salesTerm.endsAt.getTime() - salesTerm.startsAt.getTime());
    const remainingMs = Math.max(0, salesTerm.endsAt.getTime() - now.getTime());
    const unitPrice = basePrice.mul(remainingMs).div(fullMs).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const targetSeats = (current?.seats ?? 0) + input.addedSeats;
    const subtotal = unitPrice.mul(input.addedSeats).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    await tx.$executeRaw(Prisma.sql`UPDATE "telecaller_billing_orders" SET status='CANCELLED',"updatedAt"=NOW() WHERE "companyId"=${companyId}::uuid AND status='PENDING'`);
    const id = randomUUID();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "telecaller_billing_orders" (id,"companyId","createdByUserId","billingPeriod","addedSeats","targetSeats","unitPrice",subtotal,"totalAmount",status,"coTermStartsAt","coTermEndsAt","expiresAt","createdAt","updatedAt")
      VALUES (${id}::uuid,${companyId}::uuid,${actor.id}::uuid,${period},${input.addedSeats},${targetSeats},${unitPrice},${subtotal},${subtotal},'PENDING',${startsAt},${endsAt},${expiresAt},NOW(),NOW())`);
    return { id, billingPeriod: period, addedSeats: input.addedSeats, targetSeats, unitPrice, totalAmount: subtotal, coTermEndsAt: endsAt, prorated: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listTelecallerBillingOrdersForAdmin() {
  await requireGlobalSuperAdminForMutation();
  return db.$queryRaw<TelecallerBillingOrderRow[]>(Prisma.sql`
    SELECT o.id,o."companyId",c.name AS "companyName",o."createdByUserId",u.name AS "createdByName",o."billingPeriod",o."addedSeats",o."targetSeats",o."unitPrice",o.subtotal,o."totalAmount",o.status,o."paymentReference",o."coTermStartsAt",o."coTermEndsAt",o."paidAt",o."expiresAt",o."createdAt"
    FROM "telecaller_billing_orders" o JOIN "companies" c ON c.id=o."companyId" JOIN "users" u ON u.id=o."createdByUserId"
    ORDER BY CASE o.status WHEN 'PENDING' THEN 0 ELSE 1 END,o."createdAt" DESC LIMIT 300`);
}

export async function confirmTelecallerManualPayment(orderId: string, paymentReference: string) {
  const admin = await requireGlobalSuperAdminForMutation();
  const reference = paymentReference.trim();
  if (!reference || reference.length > 200) throw new Error("INVALID_PAYMENT_REFERENCE");
  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<TelecallerBillingOrderRow[]>(Prisma.sql`
      SELECT id,"companyId","createdByUserId","billingPeriod","addedSeats","targetSeats","unitPrice",subtotal,"totalAmount",status,"paymentReference","coTermStartsAt","coTermEndsAt","paidAt","expiresAt","createdAt"
      FROM "telecaller_billing_orders" WHERE id=${orderId}::uuid FOR UPDATE`);
    const order = rows[0];
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status === "PAID") return order;
    if (order.status !== "PENDING") throw new Error("ORDER_NOT_PENDING");
    if (order.expiresAt && order.expiresAt <= new Date()) throw new Error("ORDER_EXPIRED");
    const duplicate = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "telecaller_billing_orders" WHERE "paymentReference"=${reference} AND id<>${order.id}::uuid LIMIT 1`);
    if (duplicate.length) throw new Error("PAYMENT_REFERENCE_IN_USE");
    const now=new Date();
    const salesTerm=await activeSalesTerm(tx,order.companyId,now);
    if(!salesTerm)throw new Error("SALES_SUBSCRIPTION_REQUIRED");
    await syncTelecallerSubscriptionToSalesTerm(tx,{companyId:order.companyId,seats:order.targetSeats,billingPeriod:salesTerm.billingPeriod,startsAt:now,endsAt:salesTerm.endsAt});
    await tx.$executeRaw(Prisma.sql`UPDATE "telecaller_billing_orders" SET status='PAID',"coTermEndsAt"=${salesTerm.endsAt},"paymentReference"=${reference},"paidAt"=NOW(),"updatedAt"=NOW() WHERE id=${order.id}::uuid`);
    await tx.billingAuditEvent.create({data:{companyId:order.companyId,actorUserId:admin.id,type:"MANUAL_PAYMENT_CONFIRMED",entityId:order.id,reason:"Telecaller manual payment confirmed",metadata:{kind:"TELECALLER",reference,addedSeats:order.addedSeats,targetSeats:order.targetSeats,period:salesTerm.billingPeriod,coTermEndsAt:salesTerm.endsAt.toISOString()}}});
    return { ...order, status: "PAID" as const, paymentReference: reference, paidAt: now, coTermEndsAt:salesTerm.endsAt };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
