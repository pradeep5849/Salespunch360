import type { BillingPeriod } from "@prisma/client";

export type BillableSalesRole = "ADMIN" | "MANAGER" | "SALES";

/** PRIMARY_ADMIN is included; only additional Sales ADMIN seats are billable. */
export const SALES_ADMIN_PRICE_INR: Readonly<Record<BillingPeriod, number>> = Object.freeze({
  MONTHLY: 250,
  SIX_MONTH: 1400,
  YEARLY: 2800,
});

/** Canonical seed/config schedule. Billing orders continue to snapshot DB prices for audit history. */
export const SALES_PRICING_INR: Readonly<Record<BillableSalesRole, Readonly<Record<BillingPeriod, number>>>> = Object.freeze({
  ADMIN: SALES_ADMIN_PRICE_INR,
  MANAGER: Object.freeze({ MONTHLY: 200, SIX_MONTH: 1100, YEARLY: 2100 }),
  SALES: Object.freeze({ MONTHLY: 150, SIX_MONTH: 800, YEARLY: 1500 }),
});
