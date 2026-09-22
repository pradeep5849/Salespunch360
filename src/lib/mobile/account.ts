import type { AccountModule } from "@prisma/client";
import { db } from "@/lib/db";
import { accountBranchDashboard } from "@/lib/account/branch-dashboard";
import { dashboardCardVisibility } from "@/lib/account/dashboard-policy";
import { enabledModulesForCompany } from "@/lib/account/modules";
import { buildAccountNavigation, rolePermissionSummary } from "@/lib/account/navigation";
import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { effectiveEntitlement } from "@/lib/billing/entitlement";
import { canUsePermission } from "@/lib/auth/permissions";
import type { MobileAppPrincipal } from "./auth";

function accountActor(user: MobileAppPrincipal) {
  if (!user.authorizedWorkspaces.includes("ACCOUNT") || !user.accountRole)
    throw new Error("MOBILE_FORBIDDEN");
  return {
    id: user.id,
    name: user.name,
    companyId: user.companyId,
    role: user.role,
    isActive: true,
    salesRole: user.salesRole,
    accountRole: user.accountRole,
    salesAccessActive: user.authorizedWorkspaces.includes("SALES"),
    accountAccessActive: true,
    managerType: user.managerType,
    branchAccessScope: user.branchAccessScope,
    branchIds: user.branchIds,
  };
}

const decimalText = (value: { toString(): string }) => value.toString();

export async function mobileAccountBootstrap(user: MobileAppPrincipal, requested?: { branchId?: string | null; scope?: string | null }) {
  const actor = accountActor(user);
  const [company, modules, branch, entitlement] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: actor.companyId }, select: { name: true, productEdition: true } }),
    enabledModulesForCompany(actor.companyId),
    resolveAccountBranchContext(actor, requested),
    effectiveEntitlement(actor.companyId),
  ]);
  const filter = branch.context.mode === "BRANCH" ? { branchId: branch.context.branchId } : {};
  const pendingExpenseApprovals = modules.includes("EXPENSES")
    ? await db.expenseTransaction.count({ where: { companyId: actor.companyId, status: "PENDING_APPROVAL", ...filter } })
    : 0;
  return {
    user: { id: actor.id, name: actor.name, accountRole: actor.accountRole },
    company: { name: company.name },
    productEdition: company.productEdition,
    enabledModules: modules,
    effectivePermissions: rolePermissionSummary(actor.accountRole),
    canSwitchWorkspace: user.authorizedWorkspaces.includes("SALES"),
    branch: branch.context,
    availableBranches: branch.branches,
    canConsolidate: branch.canConsolidate,
    entitlement: { state: entitlement.state, operationalWritesAllowed: entitlement.operationalWritesAllowed },
    notifications: { pendingExpenseApprovals },
    navigation: buildAccountNavigation(actor, company.productEdition, modules).map(group => ({
      label: group.label,
      items: group.items,
      children: group.children?.map(child => ({ label: child.label, items: child.items })),
    })),
  };
}

export async function mobileAccountDashboard(user: MobileAppPrincipal, requested?: { branchId?: string | null; scope?: string | null }) {
  const actor = accountActor(user);
  if (!canUsePermission(actor, user.productEdition, "ACCOUNT_DASHBOARD")) throw new Error("MOBILE_FORBIDDEN");
  const branch = await resolveAccountBranchContext(actor, requested);
  const now = new Date();
  const year = await db.financialYear.findFirst({ where: { companyId: actor.companyId, status: "OPEN" }, orderBy: { startDate: "desc" }, select: { name: true, startDate: true } });
  const from = year?.startDate ?? new Date(Date.UTC(now.getUTCFullYear(), 3, 1));
  const [data, modules] = await Promise.all([accountBranchDashboard(actor, branch.context, from, now), enabledModulesForCompany(actor.companyId)]);
  const visible = dashboardCardVisibility(modules as AccountModule[]);
  if (data.projectOnly) return {
    title: branch.context.mode === "COMPANY" ? "Company Consolidated Dashboard" : `${branch.context.branchName} Dashboard`,
    period: year?.name ?? from.toISOString().slice(0, 10), projectOnly: true,
    metrics: [{ key: "projects", label: "Assigned projects", value: String(data.projects), kind: "COUNT" }, { key: "projectValue", label: "Project value", value: decimalText(data.projectValue), kind: "MONEY" }],
    branchComparison: [],
  };
  const metrics = [
    ...(visible.sales ? [["sales", "Tax-exclusive Sales Revenue", data.sales, "MONEY"], ["receivables", "Receivables", data.receivables, "MONEY"]] : []),
    ...(visible.purchases ? [["purchases", "Tax-exclusive Purchases", data.purchases, "MONEY"], ["payables", "Vendor Payables", data.payables, "MONEY"]] : []),
    ["cashBank", "Cash / Bank", data.cashBank, "MONEY"], ["profit", "Profit (A14 ledger)", data.profit, "MONEY"],
    ...(visible.expenses ? [["expenses", "Posted Expenses", data.expenses, "MONEY"]] : []),
    ...(visible.projects ? [["projects", "Active Projects", data.projects, "COUNT"], ["projectValue", "Project Value", data.projectValue, "MONEY"]] : []),
    ...(visible.inventory ? [["stockValue", "Inventory Value", data.stockValue, "MONEY"], ["warehouses", "Warehouses", data.warehouses, "COUNT"]] : []),
  ] as const;
  return {
    title: branch.context.mode === "COMPANY" ? "Company Consolidated Dashboard" : `${branch.context.branchName} Dashboard`,
    period: year?.name ?? from.toISOString().slice(0, 10), projectOnly: false,
    metrics: metrics.map(([key, label, value, kind]) => ({ key, label, value: typeof value === "number" ? String(value) : decimalText(value), kind })),
    branchComparison: data.branchComparison.map(row => ({ id: row.id, name: row.name, sales: decimalText(row.sales), expenses: decimalText(row.expenses), operatingContribution: decimalText(row.operatingContribution) })),
  };
}
