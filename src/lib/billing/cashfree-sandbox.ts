import { createHmac, timingSafeEqual } from "node:crypto";
function credentials() {
  const { CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV } = process.env;
  if (CASHFREE_ENV !== "sandbox" || !CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) throw new Error("CASHFREE_SANDBOX_UNAVAILABLE");
  return { appId: CASHFREE_APP_ID, secret: CASHFREE_SECRET_KEY };
}
async function request(path: string, body?: unknown): Promise<unknown> {
  const { appId, secret } = credentials();
  const response = await fetch("https://sandbox.cashfree.com/pg" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "x-client-id": appId, "x-client-secret": secret, "x-api-version": "2023-08-01", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("CASHFREE_REQUEST_FAILED_" + response.status);
  return response.json();
}
function orderPath(id: string) {
  if (!/^[A-Za-z0-9_-]{3,45}$/.test(id)) throw new Error("INVALID_CASHFREE_ORDER_ID");
  return "/orders/" + encodeURIComponent(id);
}
export async function createSandboxOrder(input: { orderId: string; amount: number; customerId: string; customerPhone: string; returnUrl: string }) {
  orderPath(input.orderId);
  if (!Number.isFinite(input.amount) || input.amount < 1 || Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 0.000001) throw new Error("INVALID_CASHFREE_AMOUNT");
  const result = await request("/orders", { order_id: input.orderId, order_amount: input.amount, order_currency: "INR", customer_details: { customer_id: input.customerId, customer_phone: input.customerPhone }, order_meta: { return_url: input.returnUrl } }) as { order_id?: unknown; payment_session_id?: unknown };
  if (result.order_id !== input.orderId || typeof result.payment_session_id !== "string" || !result.payment_session_id) throw new Error("INVALID_CASHFREE_RESPONSE");
  return { providerOrderId: input.orderId, paymentSessionId: result.payment_session_id };
}
export function fetchSandboxOrder(id: string) { return request(orderPath(id)); }
export function fetchSandboxPayments(id: string) { return request(orderPath(id) + "/payments"); }
export function verifySandboxWebhook(rawBody: string, timestamp: string, signature: string) {
  if (!/^\d{13}$/.test(timestamp)) return false;
  const { secret } = credentials();
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest();
  const actual = Buffer.from(signature, "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
