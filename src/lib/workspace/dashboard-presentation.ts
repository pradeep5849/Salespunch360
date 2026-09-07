import type { ManagerType, Role, SalesRole } from "@prisma/client";

export type DashboardPresentationActor = {
  role: Role;
  salesRole: SalesRole;
  managerType: ManagerType | null;
};
export function dashboardPresentation(actor: DashboardPresentationActor) {
  const isPrimaryAdmin = actor.salesRole === "PRIMARY_ADMIN",
    isAdditionalAdmin = actor.salesRole === "ADMIN",
    isAdmin = isPrimaryAdmin || isAdditionalAdmin,
    isManager = actor.salesRole === "MANAGER",
    isSales = actor.salesRole === "SALES";
  const fieldWorker =
    isSales || (isManager && actor.managerType !== "MANAGER_ONLY");
  // Owner/setup destinations still authorize the compatibility COMPANY_ADMIN role. Keep them
  // hidden from additional admins until that separate authorization gate is migrated.
  const canAccessLegacyOwnerRoutes =
    isPrimaryAdmin && actor.role === "COMPANY_ADMIN";
  const canAccessLegacyRoleRoutes = !isAdditionalAdmin;
  const navigationRoutes = isAdditionalAdmin
    ? ([
        "/workspace",
        "/workspace/attendance",
        "/workspace/customers",
        "/workspace/check-ins",
      ] as const)
    : null;
  return {
    isPrimaryAdmin,
    isAdditionalAdmin,
    isAdmin,
    isManager,
    isSales,
    fieldWorker,
    canAccessLegacyOwnerRoutes,
    canAccessLegacyRoleRoutes,
    navigationRoutes,
    navigation: isAdditionalAdmin
      ? "ADDITIONAL_ADMIN"
      : isAdmin
        ? "ADMIN"
        : isManager
          ? "MANAGER"
          : ("SALES" as const),
    label: isAdmin
      ? isPrimaryAdmin
        ? "PRIMARY ADMIN"
        : "ADMIN"
      : isManager
        ? actor.managerType === "MANAGER_ONLY"
          ? "MANAGER ONLY"
          : "FIELD MANAGER"
        : "SALES",
    introduction: isAdmin
      ? "Your company field-team overview."
      : isManager
        ? actor.managerType === "MANAGER_ONLY"
          ? "Your assigned Sales team overview."
          : "Your attendance and assigned Sales team."
        : "Your field-work overview.",
  };
}
