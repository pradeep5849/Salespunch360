import {
  cashfreeConfig,
  assertCashfreeOrderEnvironment,
} from "./cashfree-config";
import { fetchCashfreeOrder, fetchCashfreePayments } from "./cashfree-client";
import type { VerifiedPayment } from "./provider";

type Snapshot = {
  id: string;
  totalAmount: { toFixed(n: number): string };
  currency: string;
  paymentEnvironment?: string | null;
};
function amountMatches(value: unknown, expected: string) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001 &&
    value.toFixed(2) === expected
  );
}
export async function verifyCashfreePayment(
  order: Snapshot,
): Promise<VerifiedPayment | null> {
  const config = cashfreeConfig();
  assertCashfreeOrderEnvironment(order, config.environment);
  const remote = (await fetchCashfreeOrder(order.id)) as Record<
    string,
    unknown
  >;
  const expected = order.totalAmount.toFixed(2);
  if (
    remote.order_id !== order.id ||
    remote.order_currency !== "INR" ||
    order.currency !== "INR" ||
    !amountMatches(remote.order_amount, expected)
  ) {
    throw new Error("PAYMENT_MISMATCH");
  }
  if (remote.order_status !== "PAID") return null;
  const payments = await fetchCashfreePayments(order.id);
  if (!Array.isArray(payments)) throw new Error("INVALID_CASHFREE_RESPONSE");
  const payment = payments.find(
    (p) =>
      p &&
      p.payment_status === "SUCCESS" &&
      p.order_id === order.id &&
      p.payment_currency === "INR" &&
      amountMatches(p.payment_amount, expected),
  );
  if (!payment) throw new Error("PAYMENT_MISMATCH");
  const id = payment.cf_payment_id;
  if (
    (typeof id === "number" && !Number.isSafeInteger(id)) ||
    (typeof id !== "string" && typeof id !== "number") ||
    !/^\d+$/.test(String(id))
  )
    throw new Error("INVALID_PAYMENT_ID");
  const capturedAt = new Date(
    payment.payment_completion_time ?? payment.payment_time,
  );
  if (
    !Number.isFinite(capturedAt.getTime()) ||
    capturedAt.getTime() > Date.now() + 300000
  )
    throw new Error("INVALID_PAYMENT_TIME");
  return {
    provider: config.provider,
    providerPaymentId: config.paymentPrefix + id,
    orderId: order.id,
    amount: expected,
    currency: "INR",
    capturedAt,
  };
}
