import type { AccountRole, ProductEdition, SalesRole } from "@prisma/client";
import { canAccessAccountWorkspace, canAccessSalesWorkspace, canUseSalesFieldWorkflow, isPlatformSuperAdmin, type WorkspacePrincipal } from "./workspace-policy";

export const PERMISSIONS = [
  "PROFILE_SELF", "COMPANY_VIEW", "USER_DIRECTORY_VIEW", "BRANCH_VIEW", "BRANCH_ASSIGN", "SECURITY_RESET_PASSWORD",
  "SALES_DASHBOARD", "SALES_ATTENDANCE", "SALES_CUSTOMERS", "SALES_CHECK_INS", "SALES_LEADS", "SALES_FOLLOW_UPS",
  "SALES_TARGETS", "SALES_REPORTS", "SALES_TRAVEL", "SALES_USER_ADMIN", "SALES_SETTINGS", "SALES_BILLING",
  "ACCOUNT_DASHBOARD", "ACCOUNT_QUOTATION_VIEW", "ACCOUNT_QUOTATION_EDIT", "ACCOUNT_QUOTATION_APPROVE", "ACCOUNT_QUOTATION_COST_VIEW", "ACCOUNT_QUOTATION_SHARE", "ACCOUNT_SALES_ENTRY", "ACCOUNT_PURCHASE_ENTRY", "ACCOUNT_SETTLEMENT_ENTRY", "ACCOUNT_LEDGER_VIEW", "ACCOUNT_JOURNAL_DRAFT", "ACCOUNT_JOURNAL_POST", "ACCOUNT_JOURNAL_REVERSE", "ACCOUNT_OPENING_BALANCE", "ACCOUNT_PERIOD_LOCK", "ACCOUNT_CHART_ADMIN", "ACCOUNT_PROJECTS", "ACCOUNT_ACCOUNTS", "ACCOUNT_STOCK", "ACCOUNT_REPORTS", "ACCOUNT_USER_ADMIN", "ACCOUNT_SETTINGS",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type PermissionCategory = "SHARED" | "SALES" | "ACCOUNT";

export const PERMISSION_CATEGORY: Record<Permission, PermissionCategory> = Object.fromEntries(PERMISSIONS.map((permission) => [
  permission,
  permission.startsWith("SALES_") ? "SALES" : permission.startsWith("ACCOUNT_") ? "ACCOUNT" : "SHARED",
])) as Record<Permission, PermissionCategory>;

const FIELD_SALES: Permission[] = ["SALES_DASHBOARD", "SALES_ATTENDANCE", "SALES_CUSTOMERS", "SALES_CHECK_INS", "SALES_LEADS", "SALES_FOLLOW_UPS", "SALES_TARGETS", "SALES_REPORTS", "SALES_TRAVEL"];
export const PERSONAL_FIELD_PERMISSIONS: readonly Permission[] = ["SALES_ATTENDANCE", "SALES_CUSTOMERS", "SALES_CHECK_INS", "SALES_LEADS", "SALES_FOLLOW_UPS", "SALES_TARGETS", "SALES_TRAVEL"];
export const SALES_ROLE_PERMISSIONS: Record<SalesRole, readonly Permission[]> = {
  PRIMARY_ADMIN: [...FIELD_SALES, "SALES_USER_ADMIN", "SALES_SETTINGS", "SALES_BILLING"],
  ADMIN: FIELD_SALES,
  MANAGER: FIELD_SALES,
  SALES: FIELD_SALES,
};
export const ACCOUNT_ROLE_PERMISSIONS: Record<AccountRole, readonly Permission[]> = {
  ACCOUNT_ADMIN: ["ACCOUNT_DASHBOARD", "ACCOUNT_QUOTATION_VIEW", "ACCOUNT_QUOTATION_EDIT", "ACCOUNT_QUOTATION_APPROVE", "ACCOUNT_QUOTATION_COST_VIEW", "ACCOUNT_QUOTATION_SHARE", "ACCOUNT_SALES_ENTRY", "ACCOUNT_PURCHASE_ENTRY", "ACCOUNT_SETTLEMENT_ENTRY", "ACCOUNT_LEDGER_VIEW", "ACCOUNT_JOURNAL_DRAFT", "ACCOUNT_JOURNAL_POST", "ACCOUNT_JOURNAL_REVERSE", "ACCOUNT_OPENING_BALANCE", "ACCOUNT_PERIOD_LOCK", "ACCOUNT_CHART_ADMIN", "ACCOUNT_PROJECTS", "ACCOUNT_ACCOUNTS", "ACCOUNT_STOCK", "ACCOUNT_REPORTS", "ACCOUNT_USER_ADMIN", "ACCOUNT_SETTINGS"],
  ACCOUNTANT: ["ACCOUNT_DASHBOARD", "ACCOUNT_QUOTATION_VIEW", "ACCOUNT_QUOTATION_EDIT", "ACCOUNT_QUOTATION_APPROVE", "ACCOUNT_QUOTATION_COST_VIEW", "ACCOUNT_QUOTATION_SHARE", "ACCOUNT_SALES_ENTRY", "ACCOUNT_PURCHASE_ENTRY", "ACCOUNT_SETTLEMENT_ENTRY", "ACCOUNT_LEDGER_VIEW", "ACCOUNT_JOURNAL_DRAFT", "ACCOUNT_JOURNAL_POST", "ACCOUNT_JOURNAL_REVERSE", "ACCOUNT_OPENING_BALANCE", "ACCOUNT_ACCOUNTS", "ACCOUNT_REPORTS"],
  PROJECT_MANAGER: ["ACCOUNT_DASHBOARD", "ACCOUNT_QUOTATION_VIEW", "ACCOUNT_QUOTATION_EDIT", "ACCOUNT_QUOTATION_APPROVE", "ACCOUNT_QUOTATION_COST_VIEW", "ACCOUNT_QUOTATION_SHARE", "ACCOUNT_LEDGER_VIEW", "ACCOUNT_PROJECTS", "ACCOUNT_REPORTS"],
  DATA_ENTRY: ["ACCOUNT_DASHBOARD", "ACCOUNT_QUOTATION_VIEW", "ACCOUNT_QUOTATION_EDIT", "ACCOUNT_SALES_ENTRY", "ACCOUNT_PURCHASE_ENTRY", "ACCOUNT_LEDGER_VIEW", "ACCOUNT_JOURNAL_DRAFT", "ACCOUNT_ACCOUNTS", "ACCOUNT_STOCK"],
};

const ACTIVE_TENANT_SHARED: Permission[] = ["COMPANY_VIEW", "USER_DIRECTORY_VIEW", "BRANCH_VIEW"];
const ADMIN_SHARED: Permission[] = ["BRANCH_ASSIGN", "SECURITY_RESET_PASSWORD"];

/** Pure module-level policy. Record/target scope remains a service-policy concern. */
export function canUsePermission(user: WorkspacePrincipal, edition: ProductEdition | null, permission: Permission): boolean {
  if (user.isActive !== true) return false;
  if (permission === "PROFILE_SELF") return true;
  if (isPlatformSuperAdmin(user) || edition === null) return false;
  const salesActive = canAccessSalesWorkspace(user, edition);
  const accountActive = canAccessAccountWorkspace(user, edition);
  const category = PERMISSION_CATEGORY[permission];
  if (category === "SALES") return salesActive && !!user.salesRole && SALES_ROLE_PERMISSIONS[user.salesRole].includes(permission);
  if (category === "ACCOUNT") return accountActive && !!user.accountRole && ACCOUNT_ROLE_PERMISSIONS[user.accountRole].includes(permission);
  if (ACTIVE_TENANT_SHARED.includes(permission)) return salesActive || accountActive;
  if (ADMIN_SHARED.includes(permission))
    return (salesActive && (user.salesRole === "PRIMARY_ADMIN" || user.salesRole === "ADMIN")) || (accountActive && user.accountRole === "ACCOUNT_ADMIN");
  return false;
}

/** Mutation policy closes personal field workflows while preserving scoped supervisor reads. */
export function canUsePermissionForMutation(user:WorkspacePrincipal,edition:ProductEdition|null,permission:Permission){return canUsePermission(user,edition,permission)&&(!PERSONAL_FIELD_PERMISSIONS.includes(permission)||canUseSalesFieldWorkflow(user));}
