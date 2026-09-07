import { ProductEdition } from "@prisma/client";

/** Foundation-only entitlement helpers. They do not gate current routes. */
export function hasSalesWorkspace(edition: ProductEdition): boolean {
  return edition === ProductEdition.SALESPUNCH360 || edition === ProductEdition.SALESPUNCH360_PLUS;
}

export function hasAccountsWorkspace(edition: ProductEdition): boolean {
  return edition === ProductEdition.SALESPUNCH360_ACCOUNT || edition === ProductEdition.SALESPUNCH360_PLUS;
}
