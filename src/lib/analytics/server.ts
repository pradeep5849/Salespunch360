import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/authorization";
import {
  CONSENT_COOKIE,
  parseConsent,
  paymentConfirmed,
  productionPurchaseEligible,
  planParameters,
  SITE_ORIGIN,
  type PurchaseEvidence,
} from "./policy";

export function productionAnalytics() {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.APP_URL === SITE_ORIGIN &&
    process.env.ANALYTICS_ENABLED === "true"
  );
}
export function internalCompany(companyId: string) {
  return (process.env.ANALYTICS_INTERNAL_COMPANY_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .includes(companyId);
}
export function receiptKey(event: string, id: string) {
  return createHash("sha256")
    .update(`sp360-ga4-v1:${event}:${id}`)
    .digest("hex");
}
export async function queueRegistrationAnalytics(
  userId: string,
  companyId: string,
) {
  // Optional telemetry must never fail a completed registration or create proof without consent.
  try {
    if (
      !productionAnalytics() ||
      internalCompany(companyId) ||
      !parseConsent((await cookies()).get(CONSENT_COOKIE)?.value).analytics
    )
      return;
    await db.analyticsEventReceipt.createMany({
      data: [{ keyHash: receiptKey("sign_up", userId), eventName: "sign_up" }],
      skipDuplicates: true,
    });
  } catch {
    /* Registration remains successful when optional analytics storage is unavailable. */
  }
}
export async function queueCheckoutAnalytics(
  userId: string,
  companyId: string,
  orderId: string,
  consent: boolean,
) {
  try {
    if (!consent || !productionAnalytics() || internalCompany(companyId))
      return;
    await db.analyticsEventReceipt.createMany({
      data: [
        {
          keyHash: receiptKey(`begin_checkout:${userId}`, orderId),
          eventName: "begin_checkout",
          context: `cashfree:${process.env.CASHFREE_ENV ?? "unknown"}`,
        },
      ],
      skipDuplicates: true,
    });
  } catch {
    /* Payment initiation must not depend on analytics. */
  }
}
export async function confirmedOrderForActor(
  actor: { companyId: string },
  orderId: string,
) {
  const order = await db.billingOrder.findFirst({
    where: { id: orderId, companyId: actor.companyId },
    include: { payments: true },
  });
  if (!order || order.status !== "PAID") return null;
  const payment = order.payments.find(
    (p) =>
      p.status === "CAPTURED" &&
      ["CASHFREE", "CASHFREE_SANDBOX"].includes(p.provider),
  );
  if (
    !payment ||
    (payment.provider === "CASHFREE" &&
      order.paymentEnvironment !== "production")
  )
    return null;
  const capture = await db.billingAuditEvent.findFirst({
    where: {
      companyId: actor.companyId,
      entityId: payment.id,
      type: "PAYMENT_CAPTURED",
    },
    orderBy: { occurredAt: "desc" },
    select: { metadata: true },
  });
  const metadata = capture?.metadata;
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    metadata.orderId !== order.id ||
    typeof metadata.subscriptionId !== "string"
  )
    return null;
  const subscription = await db.companySubscription.findFirst({
    where: {
      id: metadata.subscriptionId,
      companyId: actor.companyId,
      status: "ACTIVE",
    },
    select: { id: true, endsAt: true },
  });
  const evidence: PurchaseEvidence = {
    ...order,
    orderId: order.id,
    amount: order.totalAmount.toFixed(2),
    paymentAmount: payment.amount.toFixed(2),
    paymentCurrency: payment.currency,
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    manualReference: payment.manualReference,
    capturedAt: payment.capturedAt,
    activated:
      !!subscription &&
      !!payment.capturedAt &&
      subscription.endsAt > payment.capturedAt,
    providerEnvironment:
      typeof metadata.providerEnvironment === "string"
        ? metadata.providerEnvironment
        : "unknown",
    internalTest: metadata.internalTest === true,
  };
  const category = [
    "new_subscription",
    "renewal",
    "additional_users",
    "account_package",
  ].includes(String(metadata.purchaseCategory))
    ? String(metadata.purchaseCategory)
    : "subscription";
  return paymentConfirmed(evidence)
    ? { order, payment, evidence, purchaseCategory: category }
    : null;
}
export async function confirmedBillingSuccess(orderId: string) {
  const actor = await requirePermission("SALES_BILLING");
  if (!actor.companyId) return null;
  return confirmedOrderForActor({ companyId: actor.companyId }, orderId);
}
export async function claimRegistration(
  userId: string,
  eventName: "sign_up" | "login" = "sign_up",
) {
  const result = await db.analyticsEventReceipt.updateMany({
    where: {
      keyHash: receiptKey(eventName, userId),
      eventName,
      claimedAt: null,
      createdAt: { gte: new Date(Date.now() - 86_400_000) },
    },
    data: { claimedAt: new Date() },
  });
  return result.count === 1 ? { method: "website" } : null;
}
export async function claimCheckout(
  actor: { id: string; companyId: string },
  orderId: string,
) {
  // The existing provider is sandbox-only. It must never produce production conversion events.
  if (process.env.CASHFREE_ENV !== "production") return null;
  const order = await db.billingOrder.findFirst({
    where: {
      id: orderId,
      companyId: actor.companyId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });
  if (!order) return null;
  const params = planParameters(
    order,
    order.totalAmount.toFixed(2),
    order.currency,
  );
  if (!params) return null;
  const result = await db.analyticsEventReceipt.updateMany({
    where: {
      keyHash: receiptKey(`begin_checkout:${actor.id}`, orderId),
      eventName: "begin_checkout",
      context: "cashfree:production",
      claimedAt: null,
      createdAt: { gte: new Date(Date.now() - 86_400_000) },
    },
    data: { claimedAt: new Date() },
  });
  return result.count === 1 ? params : null;
}
export async function claimPurchase(
  actor: { companyId: string },
  orderId: string,
) {
  const confirmed = await confirmedOrderForActor(actor, orderId);
  if (
    !confirmed ||
    !productionPurchaseEligible(
      confirmed.evidence,
      new Date(),
      productionAnalytics(),
    ) ||
    internalCompany(actor.companyId)
  )
    return null;
  const params = planParameters(
    confirmed.order,
    confirmed.payment.amount.toFixed(2),
    confirmed.payment.currency,
  );
  if (!params) return null;
  // Atomic unique insert: reloads, callbacks, tabs and other devices cannot claim twice.
  const result = await db.analyticsEventReceipt.createMany({
    data: [
      {
        keyHash: receiptKey("purchase", orderId),
        eventName: "purchase",
        claimedAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });
  return result.count === 1
    ? {
        ...params,
        transaction_id: confirmed.order.id,
        purchase_category: confirmed.purchaseCategory,
      }
    : null;
}

export async function queueLoginAnalytics(userId: string, companyId: string) {
  try {
    if (
      !productionAnalytics() ||
      internalCompany(companyId) ||
      !parseConsent((await cookies()).get(CONSENT_COOKIE)?.value).analytics
    )
      return;
    const keyHash = receiptKey("login", userId);
    await db.analyticsEventReceipt.upsert({
      where: { keyHash },
      create: { keyHash, eventName: "login" },
      update: { claimedAt: null, createdAt: new Date() },
    });
  } catch {
    /* Authentication never depends on optional analytics. */
  }
}
