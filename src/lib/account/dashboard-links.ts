import type { AccountModule, AccountRole } from "@prisma/client";
import { ACCOUNT_ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import type { AccountBranchContext } from "./branch-context";

export function dashboardLinks(
  role: AccountRole | null,
  modules: readonly AccountModule[],
  itemsEnabled: boolean,
  context: AccountBranchContext,
  from: Date,
  to: Date,
) {
  const permissions = role ? ACCOUNT_ROLE_PERMISSIONS[role] : [];
  const scope = new URLSearchParams(
    context.mode === "BRANCH"
      ? { branchId: context.branchId }
      : { scope: "all" },
  );
  const period = new URLSearchParams(scope);
  period.set("from", from.toISOString().slice(0, 10));
  period.set("to", to.toISOString().slice(0, 10));
  period.set("asOf", to.toISOString().slice(0, 10));
  const month = new URLSearchParams(period);
  month.set(
    "from",
    new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10),
  );
  const canReport = permissions.includes("ACCOUNT_REPORTS");
  const canStock =
    permissions.includes("ACCOUNT_STOCK") && modules.includes("INVENTORY");
  return {
    reports: canReport ? `/workspace/account/reports?${period}` : null,
    expenseReport:
      canReport && modules.includes("EXPENSES")
        ? `/workspace/account/reports/profit-loss?${month}`
        : null,
    cashBank: canReport
      ? `/workspace/account/reports/cash-bank?${period}`
      : null,
    items:
      canStock && itemsEnabled
        ? `/workspace/account/inventory?${period}`
        : null,
    lowStock:
      canStock && itemsEnabled
        ? `/workspace/account/inventory/low-stock?${period}`
        : null,
  };
}

/** Zero stays zero; negative values remain visibly negative, with exact numeric labels beside bars. */
export function signedTrendPercent(value: string, values: readonly string[]) {
  const max = Math.max(1, ...values.map((v) => Math.abs(Number(v))));
  return (Number(value) / max) * 100;
}
