import { createExpenseAction } from "@/app/actions/expenses";
import { expenseOptions } from "@/lib/account/expenses";
import { requirePermission } from "@/lib/auth/authorization";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { ExpenseForm } from "../expense-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requirePermission("ACCOUNT_EXPENSE_ENTRY");
  const [options, { saved }] = await Promise.all([
    expenseOptions(),
    searchParams,
  ]);
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="New Expense / Income"
          backHref="/workspace/account/expenses"
        />
        <ExpenseForm
          options={options}
          action={createExpenseAction}
          formKey={saved ?? "new"}
        />
      </section>
    </div>
  );
}
