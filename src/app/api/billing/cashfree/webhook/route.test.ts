import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  order: vi.fn(),
  signature: vi.fn(),
  verify: vi.fn(),
  activate: vi.fn(),
  available: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { billingOrder: { findUnique: m.order } } }));
vi.mock("@/lib/billing/cashfree-client", () => ({
  verifyCashfreeWebhook: m.signature,
}));
vi.mock("@/lib/billing/cashfree-config", () => ({
  cashfreeAvailable: m.available,
}));
vi.mock("@/lib/billing/cashfree-verification", () => ({
  verifyCashfreePayment: m.verify,
}));
vi.mock("@/lib/billing/service", () => ({
  activateVerifiedPayment: m.activate,
}));
import { POST } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const payload = {
  type: "PAYMENT_SUCCESS_WEBHOOK",
  data: {
    order: { order_id: id },
    payment: {
      cf_payment_id: 123,
      payment_amount: 100,
      payment_currency: "INR",
      payment_status: "SUCCESS",
    },
  },
};
const request = (body: unknown = payload) =>
  new Request("https://www.salespunch360.com/api/billing/cashfree/webhook", {
    method: "POST",
    headers: {
      "x-webhook-timestamp": String(Date.now()),
      "x-webhook-signature": "fixture",
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.available.mockReturnValue(true);
  m.signature.mockReturnValue(true);
  m.order.mockResolvedValue({ id, paymentEnvironment: "production" });
  m.verify.mockResolvedValue({
    provider: "CASHFREE",
    providerPaymentId: "cashfree_live_123",
    amount: "100.00",
    orderId: id,
  });
  m.activate.mockResolvedValue(undefined);
});
it("activates only after signature, independent server capture verification and payload ID/value checks", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(m.verify).toHaveBeenCalledWith({
    id,
    paymentEnvironment: "production",
  });
  expect(m.activate).toHaveBeenCalledTimes(1);
});
it("passes repeated notifications through the existing transactional idempotency authority", async () => {
  await POST(request());
  await POST(request());
  expect(m.activate).toHaveBeenCalledTimes(2);
});
it("rejects invalid signatures before database or gateway access", async () => {
  m.signature.mockReturnValue(false);
  expect((await POST(request())).status).toBe(401);
  expect(m.order).not.toHaveBeenCalled();
});
it.each(["PAYMENT_FAILED_WEBHOOK", "PAYMENT_USER_DROPPED_WEBHOOK"])(
  "acknowledges %s without activation or payment mutation",
  async (type) => {
    expect(
      (
        await POST(
          request({
            ...payload,
            type,
            data: {
              ...payload.data,
              payment: { ...payload.data.payment, payment_status: "FAILED" },
            },
          }),
        )
      ).status,
    ).toBe(200);
    expect(m.verify).not.toHaveBeenCalled();
    expect(m.activate).not.toHaveBeenCalled();
  },
);
it.each([
  { cf_payment_id: 124 },
  { payment_amount: 99 },
  { payment_currency: "USD" },
])("rejects mismatched notification %o", async (patch) => {
  expect(
    (
      await POST(
        request({
          ...payload,
          data: {
            ...payload.data,
            payment: { ...payload.data.payment, ...patch },
          },
        }),
      )
    ).status,
  ).toBe(400);
  expect(m.activate).not.toHaveBeenCalled();
});
it("retries unconfirmed remote state without activating", async () => {
  m.verify.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(503);
  expect(m.activate).not.toHaveBeenCalled();
});
it("never reclassifies a sandbox order during a live webhook", async () => {
  m.verify.mockRejectedValue(new Error("PAYMENT_ENVIRONMENT_MISMATCH"));
  expect((await POST(request())).status).toBe(409);
  expect(m.activate).not.toHaveBeenCalled();
});
