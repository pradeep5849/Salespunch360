import type { ManagerType, ProductEdition, SalesRole } from "@prisma/client";
import { canUsePermission } from "./permissions";
import type { WorkspacePrincipal } from "./workspace-policy";

export type SalesHeaderKind = "ADMIN" | "MANAGER" | "SALES";

/** Canonical SalesRole drives header access and presentation; legacy Role is compatibility data only. */
export function salesHeaderPresentation(salesRole: SalesRole | null, managerType: ManagerType | null) {
  if (salesRole === "PRIMARY_ADMIN") return { kind: "ADMIN" as const, label: "Primary Admin" };
  if (salesRole === "ADMIN") return { kind: "ADMIN" as const, label: "Additional Admin" };
  if (salesRole === "MANAGER") return { kind: "MANAGER" as const, label: managerType === "MANAGER_ONLY" ? "Office Manager" : "Sales Manager" };
  if (salesRole === "SALES") return { kind: "SALES" as const, label: "Sales" };
  return null;
}

/** Navigation authorization delegates to the same permission policy used by server routes. */
export function salesHeaderCapabilities(actor: WorkspacePrincipal, edition: ProductEdition) {
  return {
    canManageEmployees: canUsePermission(actor, edition, "SALES_USER_ADMIN"),
    // Additional Admin is an operational admin seat, not the subscription owner.
    canManageBilling: actor.salesRole !== "ADMIN" && canUsePermission(actor, edition, "SALES_BILLING"),
    canManageSettings: canUsePermission(actor, edition, "SALES_SETTINGS"),
  };
}
