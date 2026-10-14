import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { ClientMoney } from "@/components/account/display-preferences";
import { ActionFeedbackForm } from "@/components/account/action-feedback-form";
import { categoryAction } from "@/app/actions/expenses";
import {
  expenseCategoryOptionsForActor,
  expenseSummaryForActor,
} from "@/lib/account/expenses";
import { requirePermission } from "@/lib/auth/authorization";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { ExpenseCategoryForm } from "@/components/account/expense-category-form";
import { SaveSubmitButton } from "@/components/account/save-feedback";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branchId?: string; scope?: string }>;
}) {
  const { q = "", branchId, scope } = await searchParams,
    a = await requirePermission("ACCOUNT_EXPENSE_VIEW"),
    o = await expenseCategoryOptionsForActor(
      { ...a, companyId: a.companyId! },
      q,
    );
  const scoped = await resolveAccountBranchContext({ ...a, companyId: a.companyId! }, { branchId, scope });
  const scopedBranch = scoped.context.mode === "BRANCH" ? scoped.context.branchId : undefined;
  const scopeQuery = scopedBranch ? `branchId=${scopedBranch}` : "scope=all";
  const totals = await expenseSummaryForActor(
    { ...a, companyId: a.companyId! },
    { branchId: scopedBranch },
    q,
  );
  const amounts = new Map(
    totals.categories.map((row) => [row.categoryId, row]),
  );
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="Expense / Income Categories"
          backHref={`/workspace/account/expenses?${scopeQuery}`}
        />
        <form method="get" className="stack">
          {scopedBranch ? <input type="hidden" name="branchId" value={scopedBranch} /> : <input type="hidden" name="scope" value="all" />}
          <label>
            Search categories
            <input name="q" defaultValue={q} maxLength={160} />
          </label>
          <button>Search</button>
        </form>
        <section aria-label="Category posted totals">
          <h2>Posted totals · {scoped.context.mode === "COMPANY" ? "Company consolidated" : scoped.context.branchName} · all history</h2>
          <p>
            Expense: <ClientMoney value={totals.expense} /> · Other income:{" "}
            <ClientMoney value={totals.income} />
          </p>
          <p>
            {totals.recognition} Category search applies to these totals;
            inactive categories retain their history.
          </p>
        </section>
        {o.canManage && (
          <details>
            <summary>Create category</summary>
            <ExpenseCategoryForm ledgers={o.ledgers} />
          </details>
        )}
        {!o.categories.length && (
          <p>
            No categories found.{" "}
            {o.canManage
              ? "Create a category to classify expenses or other income."
              : "Ask an Account administrator to create a category."}
          </p>
        )}
        {o.categories.map((x) => (
          <article key={x.id}>
            <h2>{x.name}</h2>
            <p>
              Expense:{" "}
              <ClientMoney value={amounts.get(x.id)?.expense ?? "0.00"} /> ·
              Other income:{" "}
              <ClientMoney value={amounts.get(x.id)?.income ?? "0.00"} />
            </p>
            <p>
              {x.scope} · {x.isActive ? "Active" : "Inactive"}
            </p>
            {o.canManage && (
              <>
                <details>
                  <summary>Edit {x.name}</summary>
                  <ExpenseCategoryForm ledgers={o.ledgers} category={x} />
                </details>
                {x.isActive && (
                  <ActionFeedbackForm action={categoryAction}>
                    <input type="hidden" name="id" value={x.id} />
                    <input type="hidden" name="operation" value="deactivate" />
                    <SaveSubmitButton>Deactivate {x.name}</SaveSubmitButton>
                  </ActionFeedbackForm>
                )}
              </>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
