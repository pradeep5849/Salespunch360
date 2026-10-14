import Link from "next/link";
import { createExpenseAction } from "@/app/actions/expenses";
import { expenseOptionsForActor } from "@/lib/account/expenses";
import {
  requirePermission,
  AuthorizationError,
} from "@/lib/auth/authorization";
import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { ExpenseForm } from "../expense-form";
type Query = { saved?: string; branchId?: string; scope?: string };
async function load(query: Query) {
  try {
    const authenticated = await requirePermission("ACCOUNT_EXPENSE_ENTRY");
    const actor = { ...authenticated, companyId: authenticated.companyId! };
    const context = await resolveAccountBranchContext(actor, {
      branchId: query.branchId,
      scope: query.scope,
    });
    const options = await expenseOptionsForActor(actor);
    if (context.context.mode === "BRANCH") {
      const selected = context.context.branchId;
      options.branches = [
        ...options.branches.filter((row) => row.id === selected),
        ...options.branches.filter((row) => row.id !== selected),
      ];
    }
    const backHref =
      context.context.mode === "BRANCH"
        ? `/workspace/account/expenses?branchId=${context.context.branchId}`
        : "/workspace/account/expenses?scope=all";
    return { kind: "ready" as const, options, backHref };
  } catch (error) {
    if (
      !(error instanceof AuthorizationError) &&
      !(error instanceof Error && error.message.startsWith("MODULE_DISABLED:"))
    )
      throw error;
    return { kind: "denied" as const };
  }
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const query = await searchParams;
  const result = await load(query);
  if (result.kind === "denied")
    return (
      <section className="account-card" role="status">
        <h1>Expense entry unavailable</h1>
        <p>
          Your permission, branch access or module settings do not allow this
          entry.
        </p>
        <Link href="/workspace/account/expenses">Back to Expenses</Link>
      </section>
    );
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="New Expense / Income"
          backHref={result.backHref}
        />
        <ExpenseForm
          options={result.options}
          action={createExpenseAction}
          formKey={query.saved ?? "new"}
        />
      </section>
    </div>
  );
}
