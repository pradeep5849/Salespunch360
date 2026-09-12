import type { AccountModule, ExpenseTransactionType } from "@prisma/client";

/** A9 posts these types to Expense-class ledgers; OTHER_INCOME posts to Income. */
export const DASHBOARD_EXPENSE_TYPES = ["PROJECT_EXPENSE", "OFFICE_EXPENSE", "REIMBURSEMENT"] as const satisfies readonly ExpenseTransactionType[];

export function dashboardCardVisibility(modules: readonly AccountModule[]) {
  return {
    sales: modules.includes("SALES"),
    purchases: modules.includes("PURCHASES"),
    expenses: modules.includes("EXPENSES"),
    projects: modules.includes("PROJECTS"),
    inventory: modules.includes("INVENTORY"),
  };
}
