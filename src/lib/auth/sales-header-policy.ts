import type { ManagerType, SalesRole } from "@prisma/client";

export type SalesHeaderKind = "ADMIN" | "MANAGER" | "SALES";

/** Canonical SalesRole drives header access and presentation; legacy Role is compatibility data only. */
export function salesHeaderPresentation(salesRole: SalesRole | null, managerType: ManagerType | null) {
  if (salesRole === "PRIMARY_ADMIN") return { kind: "ADMIN" as const, label: "Primary Admin" };
  if (salesRole === "ADMIN") return { kind: "ADMIN" as const, label: "Additional Admin" };
  if (salesRole === "MANAGER") return { kind: "MANAGER" as const, label: managerType === "MANAGER_ONLY" ? "Office Manager" : "Sales Manager" };
  if (salesRole === "SALES") return { kind: "SALES" as const, label: "Sales" };
  return null;
}
