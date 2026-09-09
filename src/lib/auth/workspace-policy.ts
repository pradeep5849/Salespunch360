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

export const isPlatformSuperAdmin = (user: Pick<WorkspacePrincipal, "role">) => user.role === "SUPER_ADMIN";
export const hasSalesRole = (user: Pick<WorkspacePrincipal, "salesRole">) => user.salesRole != null;
export const hasAccountRole = (user: Pick<WorkspacePrincipal, "accountRole">) => user.accountRole != null;
export const isSalesPrimaryAdmin = (user: Pick<WorkspacePrincipal, "salesRole">) => user.salesRole === "PRIMARY_ADMIN";
export const isSalesAdmin = (user: Pick<WorkspacePrincipal, "salesRole">) => user.salesRole === "PRIMARY_ADMIN" || user.salesRole === "ADMIN";
/** Assignment/capability helpers; callers must use canAccess* for effective authorization. */
export const canAdministerSalesWorkspace = (user: Pick<WorkspacePrincipal, "salesRole">) => isSalesAdmin(user);
export const canUseSalesFieldWorkflow = (user: Pick<WorkspacePrincipal, "salesRole" | "managerType">) => user.salesRole === "SALES" || (user.salesRole === "MANAGER" && user.managerType !== "MANAGER_ONLY");
export const canUseAccountWorkspace = (user: Pick<WorkspacePrincipal, "accountRole" | "role">) => user.role === "COMPANY_ADMIN" || hasAccountRole(user);

export const editionAllowsSalesWorkspace = (edition: ProductEdition) => edition === "SALESPUNCH360" || edition === "SALESPUNCH360_PLUS";
export const editionAllowsAccountWorkspace = (edition: ProductEdition) => edition === "SALESPUNCH360_ACCOUNT" || edition === "SALESPUNCH360_PLUS";
export const canAccessSalesWorkspace = (user: WorkspacePrincipal, edition: ProductEdition) =>
  user.isActive === true &&
  user.companyId !== null &&
  !isPlatformSuperAdmin(user) &&
  hasSalesRole(user) &&
  user.salesAccessActive === true &&
  editionAllowsSalesWorkspace(edition);

export const canAccessAccountWorkspace = (user: WorkspacePrincipal, edition: ProductEdition) =>
  user.isActive === true &&
  user.companyId !== null &&
  !isPlatformSuperAdmin(user) &&
  canUseAccountWorkspace(user) &&
  user.accountAccessActive === true &&
  editionAllowsAccountWorkspace(edition);

export type ProductWorkspace = "SALES" | "ACCOUNTS";
export function availableWorkspaces(user: WorkspacePrincipal, edition: ProductEdition): ProductWorkspace[] {
  return [canAccessSalesWorkspace(user, edition) ? "SALES" : null, canAccessAccountWorkspace(user, edition) ? "ACCOUNTS" : null].filter((workspace): workspace is ProductWorkspace => workspace !== null);
}
