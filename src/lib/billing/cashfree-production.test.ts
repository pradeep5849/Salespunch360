import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  cashfreeConfig,
  cashfreeAvailable,
  assertCashfreeOrderEnvironment,
} from "./cashfree-config";
import { createCashfreeOrder, verifyCashfreeWebhook } from "./cashfree-client";
const id = "11111111-1111-4111-8111-111111111111";
const input = {
  orderId: id,
  amount: 100.25,
  customerId: "synthetic",
  customerPhone: "9876543210",
  returnUrl: "https://www.salespunch360.com/workspace/billing/pending",
  expiresAt: new Date(Date.now() + 86400000),
};
const fetcher = vi.fn();
beforeEach(() => {
  vi.stubEnv("CASHFREE_ENV", "production");
  vi.stubEnv("CASHFREE_APP_ID", "fixture-app");
  vi.stubEnv("CASHFREE_SECRET_KEY", "fixture-only-secret");
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset();
  fetcher.mockResolvedValue(
    Response.json({
      order_id: id,
      order_amount: 100.25,
      order_currency: "INR",
      order_status: "ACTIVE",
      payment_session_id: "fixture-session",
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it.each(["production", "sandbox"])(
  "uses explicit %s endpoint, auth and idempotency without exposing credentials",
  async (env) => {
    vi.stubEnv("CASHFREE_ENV", env);
    await createCashfreeOrder(input);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(
      env === "production"
        ? "https://api.cashfree.com/pg/orders"
        : "https://sandbox.cashfree.com/pg/orders",
    );
    expect(options.headers).toMatchObject({
      "x-api-version": "2023-08-01",
      "x-idempotency-key": id,
    });
    expect(JSON.parse(options.body).order_expiry_time).toBe(
      input.expiresAt.toISOString(),
    );
    expect(JSON.parse(options.body)).not.toHaveProperty("secret");
  },
);
it.each(["", "live", "test", "PRODUCTION"])(
  "rejects invalid/missing environment %s without falling back",
  async (env) => {
    vi.stubEnv("CASHFREE_ENV", env);
    expect(cashfreeAvailable()).toBe(false);
    await expect(createCashfreeOrder(input)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it.each(["CASHFREE_APP_ID", "CASHFREE_SECRET_KEY"])(
  "rejects missing credential %s",
  (key) => {
    vi.stubEnv(key, "");
    expect(() => cashfreeConfig()).toThrow("CASHFREE_UNAVAILABLE");
  },
);
it("rejects sandbox and legacy orders against live before processing", () => {
  expect(() => assertCashfreeOrderEnvironment({})).toThrow(
    "PAYMENT_ENVIRONMENT_MISMATCH",
  );
  expect(() =>
    assertCashfreeOrderEnvironment({ paymentEnvironment: "sandbox" }),
  ).toThrow();
  expect(() =>
    assertCashfreeOrderEnvironment({ paymentEnvironment: "production" }),
  ).not.toThrow();
});
describe("signed raw webhook and replay window", () => {
  const body = '{"type":"PAYMENT_SUCCESS_WEBHOOK"}';
  function signed(timestamp: string, raw = body) {
    return createHmac("sha256", "fixture-only-secret")
      .update(timestamp + raw)
      .digest("base64");
  }
  it("accepts exact raw bytes with recent timestamp and rejects mutations", () => {
    const t = String(Date.now());
    expect(verifyCashfreeWebhook(body, t, signed(t))).toBe(true);
    expect(verifyCashfreeWebhook(body + " ", t, signed(t))).toBe(false);
    expect(verifyCashfreeWebhook(body, t, "invalid")).toBe(false);
  });
  it.each([-301000, 301000])(
    "rejects a valid signature outside clock window %s",
    (delta) => {
      const t = String(Date.now() + delta);
      expect(verifyCashfreeWebhook(body, t, signed(t))).toBe(false);
    },
  );
});
