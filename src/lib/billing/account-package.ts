import type { AccountRole, BillingPeriod } from "@prisma/client";

/** A package is indivisible: no Account seat can be substituted for another role. */
export const ACCOUNT_PACKAGE_SIX_MONTH_PRICE_INR = 400;
export const ACCOUNT_PACKAGE_YEARLY_PRICE_INR = 700;
export const ACCOUNT_PACKAGE_ORDER_PROVIDER = "ACCOUNT_PACKAGE";
export const ACCOUNT_PACKAGE_ROLES = Object.freeze(["ACCOUNT_ADMIN","ACCOUNTANT","PROJECT_MANAGER","DATA_ENTRY"] as const satisfies readonly AccountRole[]);
export const ACCOUNT_PACKAGE_SEATS: Readonly<Record<AccountRole, 1>> = Object.freeze({
  ACCOUNT_ADMIN: 1,
  ACCOUNTANT: 1,
  PROJECT_MANAGER: 1,
  DATA_ENTRY: 1,
});
export const accountPackageDefaultPrice=(period:BillingPeriod)=>period==="SIX_MONTH"?ACCOUNT_PACKAGE_SIX_MONTH_PRICE_INR:ACCOUNT_PACKAGE_YEARLY_PRICE_INR;
export const accountPackageLimits=(packageCount:number)=>Object.fromEntries(ACCOUNT_PACKAGE_ROLES.map(role=>[role,Math.max(0,packageCount)])) as Record<AccountRole,number>;
