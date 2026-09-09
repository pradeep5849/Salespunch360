import type { BillingPeriod } from "@prisma/client";

/** PRIMARY_ADMIN is included; only additional Sales ADMIN seats are billable. */
export const SALES_ADMIN_PRICE_INR: Readonly<Record<BillingPeriod, number>> = Object.freeze({
  MONTHLY: 250,
  SIX_MONTH: 1400,
  YEARLY: 2800,
});
