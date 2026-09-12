import type { AccountRole, ManagerType, ProductEdition, Role, SalesRole } from "@prisma/client";

export type WorkspacePrincipal = {
  companyId: string | null;
  role: Role;
  isActive: boolean;
  salesRole: SalesRole | null;
  accountRole: AccountRole | null;
  salesAccessActive: boolean;
  accountAccessActive: boolean;
  managerType: ManagerType | null;
};

/** A platform administrator is deliberately outside every tenant. */
export const isPlatformSuperAdmin = (user: Pick<WorkspacePrincipal, "role" | "companyId">) =>
  user.role === "SUPER_ADMIN" && user.companyId === null;

/** A legacy SUPER_ADMIN value attached to a tenant is invalid, not a tenant entitlement. */
export const hasMalformedPlatformIdentity = (user: Pick<WorkspacePrincipal, "role" | "companyId">) =>
  user.role === "SUPER_ADMIN" && user.companyId !== null;
export const hasSalesRole = (user: Pick<WorkspacePrincipal, "salesRole">) => user.salesRole != null;
export const hasAccountRole = (user: Pick<WorkspacePrincipal, "accountRole">) => user.accountRole != null;
export const isSalesPrimaryAdmin = (user: Pick<WorkspacePrincipal, "salesRole">) => user.salesRole === "PRIMARY_ADMIN";
export const isSalesAdmin = (user: Pick<WorkspacePrincipal, "salesRole">) => user.salesRole === "PRIMARY_ADMIN" || user.salesRole === "ADMIN";
/** Assignment/capability helpers; callers must use canAccess* for effective authorization. */
export const canAdministerSalesWorkspace = (user: Pick<WorkspacePrincipal, "salesRole">) => isSalesAdmin(user);
export const canUseSalesFieldWorkflow = (user: Pick<WorkspacePrincipal, "salesRole" | "managerType">) =>
  user.salesRole === "SALES" || (user.salesRole === "MANAGER" && user.managerType === "FIELD_MANAGER");
export const canUseAccountWorkspace = (user: Pick<WorkspacePrincipal, "accountRole">) => hasAccountRole(user);

export const editionAllowsSalesWorkspace = (edition: ProductEdition) => edition === "SALESPUNCH360" || edition === "SALESPUNCH360_PLUS";
export const editionAllowsAccountWorkspace = (edition: ProductEdition) => edition === "SALESPUNCH360_ACCOUNT" || edition === "SALESPUNCH360_PLUS";
export const canAccessSalesWorkspace = (user: WorkspacePrincipal, edition: ProductEdition) =>
  user.isActive === true &&
  user.companyId !== null &&
  user.role !== "SUPER_ADMIN" &&
  hasSalesRole(user) &&
  user.salesAccessActive === true &&
  editionAllowsSalesWorkspace(edition);

export const canAccessAccountWorkspace = (user: WorkspacePrincipal, edition: ProductEdition) =>
  user.isActive === true &&
  user.companyId !== null &&
  user.role !== "SUPER_ADMIN" &&
  hasAccountRole(user) &&
  user.accountAccessActive === true &&
  editionAllowsAccountWorkspace(edition);

export type WebWorkspace = "SALES" | "ACCOUNT";
export type WorkspaceAccess = {
  canAccessSales: boolean;
  canAccessAccount: boolean;
  canSwitchWorkspace: boolean;
  defaultWorkspace: WebWorkspace | null;
  effectiveWorkspace: WebWorkspace | null;
};

/** The single policy for web workspace choice. A preference is never an entitlement. */
export function resolveWorkspaceAccess(
  user: WorkspacePrincipal,
  edition: ProductEdition,
  preferred?: string | null,
): WorkspaceAccess {
  const canAccessSales = canAccessSalesWorkspace(user, edition);
  const canAccessAccount = canAccessAccountWorkspace(user, edition);
  const canSwitchWorkspace = edition === "SALESPUNCH360_PLUS" && canAccessSales && canAccessAccount;
  const validPreference = canSwitchWorkspace && (preferred === "SALES" || preferred === "ACCOUNT")
    ? preferred
    : null;
  const defaultWorkspace: WebWorkspace | null = canAccessSales
    ? "SALES"
    : canAccessAccount
      ? "ACCOUNT"
      : null;
  return {
    canAccessSales,
    canAccessAccount,
    canSwitchWorkspace,
    defaultWorkspace,
    effectiveWorkspace: validPreference ?? defaultWorkspace,
  };
}
