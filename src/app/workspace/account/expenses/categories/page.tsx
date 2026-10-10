import { ActionFeedbackForm } from "@/components/account/action-feedback-form";
import { categoryAction } from "@/app/actions/expenses";
import { expenseCategoryOptionsForActor } from "@/lib/account/expenses";
import { requirePermission } from "@/lib/auth/authorization";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { ExpenseCategoryForm } from "@/components/account/expense-category-form";
import { SaveSubmitButton } from "@/components/account/save-feedback";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams,
    a = await requirePermission("ACCOUNT_EXPENSE_VIEW"),
    o = await expenseCategoryOptionsForActor(
      { ...a, companyId: a.companyId! },
      q,
    );
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="Expense / Income Categories"
          backHref="/workspace/account/expenses"
        />
        <form method="get" className="stack">
          <label>
            Search categories
            <input name="q" defaultValue={q} maxLength={160} />
          </label>
          <button>Search</button>
        </form>
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
