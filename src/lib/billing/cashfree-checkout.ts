import { activateVerifiedPayment } from "./service";
import { db } from "@/lib/db";
import { createSandboxOrder } from "./cashfree-sandbox";
import { verifyCashfreeSandboxPayment } from "./cashfree-verification";

export function normalizeCashfreePhone(value: string | null | undefined) {
  const digits = value?.replace(/[^0-9]/g, "").replace(/^(?:0091|91|0)(?=\d{10}$)/, "");
  return digits && /^[6-9]\d{9}$/.test(digits) ? digits : null;
}
type Actor = { id: string; companyId: string };
function assertSandbox() {
  if (process.env.CASHFREE_ENV !== "sandbox") {
    throw new Error("CASHFREE_SANDBOX_UNAVAILABLE");
  }
}
async function loadOrder(actor: Actor, orderId: string) {
  assertSandbox();
  const order = await db.billingOrder.findFirst({ where: { id: orderId, companyId: actor.companyId } });
  if (!order) throw new Error("NOT_FOUND");
  return order;
}
// Callers must enforce billing mutation permission before passing the authenticated actor.
export async function startCashfreeCheckout(actor: Actor, orderId: string, channel: "web" | "android" = "web") {
  const order = await loadOrder(actor, orderId);
  if (order.status !== "PENDING" || !order.expiresAt || order.expiresAt <= new Date() || order.currency !== "INR") throw new Error("ORDER_NOT_PAYABLE");
  const user = await db.user.findFirst({ where: { id: actor.id, companyId: actor.companyId }, select: { phone: true } });
  const company = await db.company.findUnique({where:{id:actor.companyId},select:{primaryPhone:true}});
  const phone = normalizeCashfreePhone(user?.phone) ?? normalizeCashfreePhone(company?.primaryPhone);
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) throw new Error("VALID_PHONE_REQUIRED");
  const url = new URL(channel === "android" ? "/payment/sandbox/complete" : "/workspace/billing/pending", "https://www.salespunch360.com");
  url.searchParams.set("order", order.id);
  if(channel === "web") { url.searchParams.set("online", "1"); url.searchParams.set("returned", "1"); }
  return createSandboxOrder({ orderId: order.id, amount: Number(order.totalAmount), customerId: actor.id, customerPhone: phone, returnUrl: url.toString() });
}
export async function inspectCashfreeCheckout(actor: Actor, orderId: string) {
  const order = await loadOrder(actor, orderId);
  const verified = await verifyCashfreeSandboxPayment(order);
  if (verified) await activateVerifiedPayment(verified);
  return { verified: Boolean(verified), activated: Boolean(verified), orderId: order.id };
}
