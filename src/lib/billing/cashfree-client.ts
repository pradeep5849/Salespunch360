import { createHmac, timingSafeEqual } from "node:crypto";
import { cashfreeConfig, CASHFREE_API_VERSION } from "./cashfree-config";
async function request(
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<unknown> {
  const { appId, secret, apiUrl } = cashfreeConfig();
  const response = await fetch(apiUrl + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "x-client-id": appId,
      "x-client-secret": secret,
      "x-api-version": CASHFREE_API_VERSION,
      "content-type": "application/json",
      ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error("CASHFREE_REQUEST_FAILED_" + response.status);
  return response.json();
}
function orderPath(id: string) {
  if (!/^[A-Za-z0-9_-]{3,45}$/.test(id))
    throw new Error("INVALID_CASHFREE_ORDER_ID");
  return "/orders/" + encodeURIComponent(id);
}
export async function createCashfreeOrder(input: {
  orderId: string;
  amount: number;
  customerId: string;
  customerPhone: string;
  returnUrl: string;
  expiresAt?: Date;
}) {
  orderPath(input.orderId);
  if (
    !Number.isFinite(input.amount) ||
    input.amount < 1 ||
    Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 0.000001
  )
    throw new Error("INVALID_CASHFREE_AMOUNT");
  const result = (await request(
    "/orders",
    {
      order_id: input.orderId,
      order_amount: input.amount,
      order_currency: "INR",
      ...(input.expiresAt
        ? { order_expiry_time: input.expiresAt.toISOString() }
        : {}),
      customer_details: {
        customer_id: input.customerId,
        customer_phone: input.customerPhone,
      },
      order_meta: { return_url: input.returnUrl },
    },
    input.orderId,
  )) as {
    order_id?: unknown;
    payment_session_id?: unknown;
    order_amount?: unknown;
    order_currency?: unknown;
    order_status?: unknown;
  };
  if (
    result.order_id !== input.orderId ||
    result.order_currency !== "INR" ||
    typeof result.order_amount !== "number" ||
    result.order_amount.toFixed(2) !== input.amount.toFixed(2) ||
    result.order_status !== "ACTIVE" ||
    typeof result.payment_session_id !== "string" ||
    !result.payment_session_id
  )
    throw new Error("INVALID_CASHFREE_RESPONSE");
  return {
    providerOrderId: input.orderId,
    paymentSessionId: result.payment_session_id,
  };
}
export function fetchCashfreeOrder(id: string) {
  return request(orderPath(id));
}
export function fetchCashfreePayments(id: string) {
  return request(orderPath(id) + "/payments");
}
export function verifyCashfreeWebhook(
  rawBody: string,
  timestamp: string,
  signature: string,
) {
  if (
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(Date.now() - Number(timestamp)) > 300000 ||
    !/^[A-Za-z0-9+/]{43}=$/.test(signature)
  )
    return false;
  const { secret } = cashfreeConfig();
  const expected = createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest();
  const actual = Buffer.from(signature, "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
