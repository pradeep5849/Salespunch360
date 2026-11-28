export const GA4_MEASUREMENT_ID = "G-CNJNMM4XHV";
export const SITE_ORIGIN = "https://www.salespunch360.com";
export const BILLING_CONFIRMATION_COOKIE = "sp360_billing_confirmation";
export const CONSENT_COOKIE = "sp360_analytics_consent";
export type TrackingConsent = { analytics: boolean; advertising: boolean };
export const DENIED_CONSENT: TrackingConsent = {
  analytics: false,
  advertising: false,
};
export function parseConsent(value?: string | null): TrackingConsent {
  const match = /^v1:([01]):([01])$/.exec(value ?? "");
  return match
    ? {
        analytics: match[1] === "1",
        advertising: match[1] === "1" && match[2] === "1",
      }
    : DENIED_CONSENT;
}
export function consentValue(consent: TrackingConsent) {
  return `v1:${consent.analytics ? 1 : 0}:${consent.analytics && consent.advertising ? 1 : 0}`;
}
export function hasPrivacySignal(headers: Pick<Headers, "get">) {
  return headers.get("sec-gpc") === "1" || headers.get("dnt") === "1";
}
const publicPages = new Set([
  "/",
  "/about",
  "/apps",
  "/android",
  "/pricing",
  "/contact",
  "/privacy",
  "/terms",
  "/register",
  "/sign-in",
]);
export function safePagePath(path: string) {
  if (publicPages.has(path)) return path;
  if (path === "/workspace/billing/success") return path;
  if (path.startsWith("/workspace/billing")) return "/workspace/billing";
  if (path === "/workspace" || path.startsWith("/workspace/")) {
    const area = path.split("/")[2];
    return [
      "leads",
      "customers",
      "attendance",
      "check-ins",
      "settings",
      "reports",
      "account",
      "follow-ups",
      "employees",
      "telecalling",
      "targets",
    ].includes(area)
      ? `/workspace/${area}`
      : "/workspace";
  }
  if (path === "/admin" || path.startsWith("/admin/")) return "/admin";
  return "/public";
}
export function safePageLocation(href: string, advertising: boolean) {
  const input = new URL(href);
  const output = new URL(safePagePath(input.pathname), SITE_ORIGIN);
  if (advertising)
    for (const key of ["gclid", "gbraid", "wbraid"]) {
      const value = input.searchParams.get(key);
      if (value && /^[A-Za-z0-9_-]{1,256}$/.test(value))
        output.searchParams.set(key, value);
    }
  return output.href;
}
export type SubscriptionPlan = {
  billingPeriod: string;
  adminSeats: number;
  managerSeats: number;
  salesSeats: number;
  accountPackages: number;
};
export type PurchaseEvidence = SubscriptionPlan & {
  orderId: string;
  status: string;
  amount: string;
  paymentAmount: string;
  currency: string;
  paymentCurrency: string;
  provider: string;
  providerPaymentId: string;
  manualReference: string | null;
  capturedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
  paidAt: Date | null;
  activated: boolean;
  providerEnvironment: string;
  internalTest: boolean;
};
export function paymentConfirmed(e: PurchaseEvidence) {
  return (
    e.status === "PAID" &&
    e.activated &&
    !!e.paidAt &&
    !!e.capturedAt &&
    !!e.expiresAt &&
    e.capturedAt >= e.createdAt &&
    e.capturedAt <= e.expiresAt &&
    e.currency === e.paymentCurrency &&
    Number.isFinite(Number(e.amount)) &&
    Number(e.amount) === Number(e.paymentAmount) &&
    Number(e.amount) > 0
  );
}
export function productionPurchaseEligible(
  e: PurchaseEvidence,
  now: Date,
  production: boolean,
) {
  const age = e.capturedAt ? now.getTime() - e.capturedAt.getTime() : -1;
  return (
    production &&
    paymentConfirmed(e) &&
    e.provider === "CASHFREE" &&
    e.providerEnvironment === "production" &&
    !e.internalTest &&
    !e.manualReference &&
    !/sandbox|test/i.test(e.providerPaymentId) &&
    age >= 0 &&
    age <= 86_400_000
  );
}
export function planParameters(
  plan: SubscriptionPlan,
  amount: string,
  currency: string,
) {
  const value = Number(amount);
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isSafeInteger(Math.round(value * 100)) ||
    !/^[A-Z]{3}$/.test(currency) ||
    !["MONTHLY", "SIX_MONTH", "YEARLY"].includes(plan.billingPeriod) ||
    [
      plan.adminSeats,
      plan.managerSeats,
      plan.salesSeats,
      plan.accountPackages,
    ].some((n) => !Number.isInteger(n) || n < 0 || n > 10000)
  )
    return null;
  const kind =
    plan.accountPackages > 0
      ? plan.managerSeats + plan.salesSeats > 0
        ? "PLUS"
        : "ACCOUNT"
      : "SALES";
  return {
    value,
    currency,
    subscription_plan: kind,
    billing_period: plan.billingPeriod,
    admin_seats: plan.adminSeats,
    manager_seats: plan.managerSeats,
    sales_seats: plan.salesSeats,
    account_packages: plan.accountPackages,
    items: [
      {
        item_id: `SP360_${kind}_${plan.billingPeriod}`,
        item_name: `SalesPunch360 ${kind} subscription`,
        item_variant: plan.billingPeriod,
        price: value,
        quantity: 1,
      },
    ],
  };
}
