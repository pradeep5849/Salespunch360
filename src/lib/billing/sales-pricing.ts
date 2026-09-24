import type { BillingPeriod } from "@prisma/client";
export const SALES_PRICE_SCHEDULE_INR=Object.freeze({ADMIN:{MONTHLY:250,SIX_MONTH:1400,YEARLY:2800},MANAGER:{MONTHLY:200,SIX_MONTH:1100,YEARLY:2100},SALES:{MONTHLY:150,SIX_MONTH:800,YEARLY:1500}} satisfies Record<"ADMIN"|"MANAGER"|"SALES",Record<BillingPeriod,number>>);
/** PRIMARY_ADMIN is included; only additional Sales ADMIN seats are billable. */
export const SALES_ADMIN_PRICE_INR:Readonly<Record<BillingPeriod,number>>=SALES_PRICE_SCHEDULE_INR.ADMIN;
/** Telecaller is an additional paid Sales seat: no monthly plan and no trial. */
export const TELECALLER_PRICE_SCHEDULE_INR=Object.freeze({SIX_MONTH:600,YEARLY:1000} as const);
export type TelecallerBillingPeriod=keyof typeof TELECALLER_PRICE_SCHEDULE_INR;
