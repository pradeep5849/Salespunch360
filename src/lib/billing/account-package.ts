import type { AccountRole } from "@prisma/client";

/** A package is indivisible: no Account seat can be substituted for another role. */
export const ACCOUNT_PACKAGE_YEARLY_PRICE_INR = 700;
export const ACCOUNT_PACKAGE_SEATS: Readonly<Record<AccountRole, 1>> = Object.freeze({
  ACCOUNT_ADMIN: 1,
  ACCOUNTANT: 1,
  PROJECT_MANAGER: 1,
  DATA_ENTRY: 1,
});

export function accountPackageCapacity(quantity: number): Readonly<Record<AccountRole, number>> {
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error("INVALID_ACCOUNT_PACKAGE_QUANTITY");
  return Object.freeze(Object.fromEntries(Object.keys(ACCOUNT_PACKAGE_SEATS).map((role) => [role, quantity])) as Record<AccountRole, number>);
}

export function accountPackagePrice(quantity: number) {
  accountPackageCapacity(quantity);
  return quantity * ACCOUNT_PACKAGE_YEARLY_PRICE_INR;
}
