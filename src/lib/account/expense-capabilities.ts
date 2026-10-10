import type { AccountRole, ExpenseTransactionStatus } from "@prisma/client";
import { ACCOUNT_ROLE_PERMISSIONS } from "@/lib/auth/permissions";
export function expenseCapabilities(
  actor: { id: string; accountRole?: AccountRole | null },
  expense: { status: ExpenseTransactionStatus; createdById: string },
) {
  const permissions = actor.accountRole
    ? ACCOUNT_ROLE_PERMISSIONS[actor.accountRole]
    : [];
  const entry = permissions.includes("ACCOUNT_EXPENSE_ENTRY"),
    admin = actor.accountRole === "ACCOUNT_ADMIN";
  return {
    edit:
      entry && expense.status === "DRAFT" && expense.createdById === actor.id,
    submit: entry && expense.status === "DRAFT",
    cancel: entry && ["DRAFT", "PENDING_APPROVAL"].includes(expense.status),
    approve: admin && expense.status === "PENDING_APPROVAL",
    reject: admin && expense.status === "PENDING_APPROVAL",
    post:
      ["ACCOUNT_ADMIN", "ACCOUNTANT"].includes(actor.accountRole ?? "") &&
      expense.status === "APPROVED",
    reverse: admin && expense.status === "POSTED",
    attach: entry,
  };
}
