import type { ManagerType, ProductEdition, SalesRole } from "@prisma/client";
import { canUsePermission } from "./permissions";
import type { WorkspacePrincipal } from "./workspace-policy";
import {isTelecallerDesignation} from "@/lib/telecalling/policy";

export type SalesHeaderKind = "ADMIN" | "MANAGER" | "SALES" | "TELECALLER";

/** Canonical SalesRole plus the paid Telecaller designation drives header presentation. */
export function salesHeaderPresentation(salesRole: SalesRole | null, managerType: ManagerType | null, designation?:string|null) {
  if (salesRole === "PRIMARY_ADMIN") return { kind: "ADMIN" as const, label: "Primary Admin" };
  if (salesRole === "ADMIN") return { kind: "ADMIN" as const, label: "Additional Admin" };
  if (salesRole === "MANAGER") return { kind: "MANAGER" as const, label: managerType === "MANAGER_ONLY" ? "Office Manager" : "Sales Manager" };
  if (salesRole === "SALES" && isTelecallerDesignation(designation)) return {kind:"TELECALLER" as const,label:"Telecaller"};
  if (salesRole === "SALES") return { kind: "SALES" as const, label: "Sales" };
  return null;
}

/** Navigation authorization delegates to the same permission policy used by server routes. */
export function salesHeaderCapabilities(actor: WorkspacePrincipal, edition: ProductEdition) {
  return {
    canManageEmployees: canUsePermission(actor, edition, "SALES_USER_ADMIN"),
    canManageBilling: actor.salesRole !== "ADMIN" && canUsePermission(actor, edition, "SALES_BILLING"),
    canManageSettings: canUsePermission(actor, edition, "SALES_SETTINGS"),
  };
}
