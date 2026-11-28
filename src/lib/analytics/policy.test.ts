import { describe, expect, it } from "vitest";
import {
  consentValue,
  parseConsent,
  safePageLocation,
  paymentConfirmed,
  productionPurchaseEligible,
  planParameters,
  type PurchaseEvidence,
} from "./policy";
export const confirmed: PurchaseEvidence = {
  orderId: "2ca57402-472d-45ba-81f5-d204b7ef5dcc",
  status: "PAID",
  amount: "1499.75",
  paymentAmount: "1499.75",
  currency: "INR",
  paymentCurrency: "INR",
  provider: "CASHFREE",
  providerPaymentId: "987654321",
  manualReference: null,
  createdAt: new Date("2026-11-28T09:00:00Z"),
  capturedAt: new Date("2026-11-28T10:00:00Z"),
  paidAt: new Date("2026-11-28T10:00:00Z"),
  expiresAt: new Date("2026-11-28T11:00:00Z"),
  activated: true,
  providerEnvironment: "production",
  internalTest: false,
  billingPeriod: "YEARLY",
  adminSeats: 1,
  managerSeats: 2,
  salesSeats: 4,
  accountPackages: 0,
};
describe("consent and privacy-safe GA4 parameters", () => {
  it.each([undefined, "", "garbage", "v2:1:1", "true"])(
    "defaults invalid consent %s to denied",
    (value) => {
      expect(parseConsent(value)).toEqual({
        analytics: false,
        advertising: false,
      });
    },
  );
  it("keeps advertising separately optional and never permits ads without analytics", () => {
    expect(parseConsent("v1:1:0")).toEqual({
      analytics: true,
      advertising: false,
    });
    expect(parseConsent("v1:0:1")).toEqual({
      analytics: false,
      advertising: false,
    });
    expect(consentValue({ analytics: true, advertising: true })).toBe("v1:1:1");
  });
  it("removes customer paths, contact queries, fragments and document titles from page locations", () => {
    expect(
      safePageLocation(
        "https://www.salespunch360.com/workspace/customers/jane@example.com?phone=9999999999#private",
        false,
      ),
    ).toBe("https://www.salespunch360.com/workspace/customers");
    expect(
      safePageLocation(
        "https://www.salespunch360.com/workspace/billing/success?order=private&email=jane@example.com",
        false,
      ),
    ).toBe("https://www.salespunch360.com/workspace/billing/success");
  });
  it("retains only validated advertising click IDs after separate advertising consent", () => {
    expect(
      safePageLocation(
        "https://www.salespunch360.com/?gclid=ABC_123&email=private&gbraid=jane@example.com",
        true,
      ),
    ).toBe("https://www.salespunch360.com/?gclid=ABC_123");
    expect(
      safePageLocation("https://www.salespunch360.com/?gclid=ABC_123", false),
    ).toBe("https://www.salespunch360.com/");
  });
  it("uses actual decimal payment value, currency and allowlisted plan details", () => {
    const params = planParameters(
      confirmed,
      confirmed.paymentAmount,
      confirmed.currency,
    )!;
    expect(params).toMatchObject({
      value: 1499.75,
      currency: "INR",
      subscription_plan: "SALES",
      billing_period: "YEARLY",
    });
    expect(params.items[0]).toMatchObject({ quantity: 1, price: 1499.75 });
    expect(JSON.stringify(params)).not.toMatch(
      /email|phone|companyId|userId|contactName/,
    );
  });
  it.each(["MONTHLY", "SIX_MONTH", "YEARLY"])(
    "supports actual billing period %s",
    (billingPeriod) => {
      expect(
        planParameters({ ...confirmed, billingPeriod }, "1499.75", "INR")
          ?.billing_period,
      ).toBe(billingPeriod);
    },
  );
  it.each(["NaN", "Infinity", "-1", "0", "99999999999999999"])(
    "rejects unsafe values %s",
    (value) => expect(planParameters(confirmed, value, "INR")).toBeNull(),
  );
});
describe("verified purchase eligibility", () => {
  const now = new Date("2026-11-28T10:05:00Z");
  it("accepts only a captured, activated real purchase within the attribution window", () => {
    expect(paymentConfirmed(confirmed)).toBe(true);
    expect(productionPurchaseEligible(confirmed, now, true)).toBe(true);
  });
  it.each(["PENDING", "FAILED", "CANCELLED", "EXPIRED"])(
    "never confirms or converts %s orders",
    (status) => {
      expect(paymentConfirmed({ ...confirmed, status })).toBe(false);
      expect(
        productionPurchaseEligible({ ...confirmed, status }, now, true),
      ).toBe(false);
    },
  );
  it.each([
    { activated: false },
    { capturedAt: null },
    { paidAt: null },
    { paymentAmount: "1.00" },
    { paymentCurrency: "USD" },
    { capturedAt: new Date("2026-11-28T12:00:00Z") },
  ])("rejects incomplete/mismatched payment proof %o", (patch) => {
    expect(paymentConfirmed({ ...confirmed, ...patch })).toBe(false);
  });
  it.each([
    { provider: "CASHFREE_SANDBOX" },
    { provider: "TEST" },
    { provider: "MANUAL" },
    { internalTest: true },
    { manualReference: "internal" },
    { providerEnvironment: "sandbox" },
    { providerPaymentId: "cashfree_sandbox_1" },
  ])("excludes sandbox, manual and internal test revenue %o", (patch) => {
    expect(
      productionPurchaseEligible({ ...confirmed, ...patch }, now, true),
    ).toBe(false);
  });
  it("excludes old, future and non-production captures", () => {
    expect(
      productionPurchaseEligible(confirmed, new Date("2026-12-01"), true),
    ).toBe(false);
    expect(
      productionPurchaseEligible(
        confirmed,
        new Date("2026-11-28T09:59:00Z"),
        true,
      ),
    ).toBe(false);
    expect(productionPurchaseEligible(confirmed, now, false)).toBe(false);
  });
});
