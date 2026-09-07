import type { AccountRole, ProductEdition, Role, SalesRole } from "@prisma/client";

export type WorkspacePrincipal = { companyId: string | null; role: Role; salesRole?: SalesRole | null; accountRole?: AccountRole | null; managerType?: "FIELD_MANAGER" | "MANAGER_ONLY" | null };

export const isPlatformSuperAdmin = (user: Pick<WorkspacePrincipal, "role">) => user.role === "SUPER_ADMIN";
export const hasSalesRole = (user: Pick<WorkspacePrincipal, "salesRole">) => user.salesRole != null;
export const hasAccountRole = (user: Pick<WorkspacePrincipal, "accountRole">) => user.accountRole != null;
export const isSalesPrimaryAdmin = (user: Pick<WorkspacePrincipal, "salesRole">) => user.salesRole === "PRIMARY_ADMIN";
export const isSalesAdmin = (user: Pick<WorkspacePrincipal, "salesRole">) => user.salesRole === "PRIMARY_ADMIN" || user.salesRole === "ADMIN";
export const canAdministerSalesWorkspace = (user: WorkspacePrincipal) => Boolean(user.companyId) && isSalesAdmin(user);
export const canUseSalesFieldWorkflow = (user: WorkspacePrincipal) => Boolean(user.companyId) && (user.salesRole === "SALES" || (user.salesRole === "MANAGER" && user.managerType !== "MANAGER_ONLY"));
export const canUseAccountWorkspace = (user: WorkspacePrincipal) => Boolean(user.companyId) && hasAccountRole(user);

export const editionAllowsSalesWorkspace = (edition: ProductEdition) => edition === "SALESPUNCH360" || edition === "SALESPUNCH360_PLUS";
export const editionAllowsAccountWorkspace = (edition: ProductEdition) => edition === "SALESPUNCH360_ACCOUNT" || edition === "SALESPUNCH360_PLUS";
export const canAccessSalesWorkspace = (user: WorkspacePrincipal, edition: ProductEdition) => !isPlatformSuperAdmin(user) && hasSalesRole(user) && editionAllowsSalesWorkspace(edition);
export const canAccessAccountWorkspace = (user: WorkspacePrincipal, edition: ProductEdition) => !isPlatformSuperAdmin(user) && canUseAccountWorkspace(user) && editionAllowsAccountWorkspace(edition);
