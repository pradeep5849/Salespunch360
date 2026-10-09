import { notFound } from "next/navigation";
import { updateExpenseAction } from "@/app/actions/expenses";
import { expenseOptions, getExpense } from "@/lib/account/expenses";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { ExpenseForm } from "../../expense-form";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    expense = await getExpense(id);
  if (!expense.capabilities.edit) notFound();
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title={`Edit ${expense.transactionNumber}`}
          backHref={`/workspace/account/expenses/${id}`}
        />
        <ExpenseForm
          options={await expenseOptions()}
          expense={expense}
          action={updateExpenseAction}
          formKey={id}
        />
      </section>
    </div>
  );
}
