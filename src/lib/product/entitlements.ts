import type { CompanyModule, ProductEdition } from "@prisma/client";

export const editionAllowsSales = (edition: ProductEdition) => edition === "SALESPUNCH360" || edition === "SALESPUNCH360_PLUS";
export const editionAllowsAccount = (edition: ProductEdition) => edition === "SALESPUNCH360_ACCOUNT" || edition === "SALESPUNCH360_PLUS";
export function productEntitlements(edition: ProductEdition) {
  return Object.freeze({ edition, sales: editionAllowsSales(edition), account: editionAllowsAccount(edition), plus: edition === "SALESPUNCH360_PLUS" });
}

export const PUBLIC_PRODUCT_EDITIONS = Object.freeze(["SALESPUNCH360"] as const);
export const SALES_SETUP_MODULES = Object.freeze(["SALES_CRM", "ATTENDANCE", "GPS_TRACKING", "FOLLOW_UP_TASKS", "TARGETS", "REPORTS"] as const satisfies readonly CompanyModule[]);
export const SELECTABLE_SALES_MODULES = Object.freeze(["ATTENDANCE", "GPS_TRACKING", "FOLLOW_UP_TASKS", "TARGETS", "REPORTS"] as const satisfies readonly CompanyModule[]);
export function resolveEnabledModules(raw: readonly string[], edition: ProductEdition): CompanyModule[] {
  if (edition !== "SALESPUNCH360") throw new Error("PRODUCT_NOT_PUBLICLY_AVAILABLE");
  if (new Set(raw).size !== raw.length || raw.some(value => !(SELECTABLE_SALES_MODULES as readonly string[]).includes(value))) throw new Error("INVALID_MODULE_SELECTION");
  return ["SALES_CRM", ...raw] as CompanyModule[];
}
