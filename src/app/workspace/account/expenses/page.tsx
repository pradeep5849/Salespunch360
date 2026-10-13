import { ClientMoney } from "@/components/account/display-preferences";
import Link from "next/link";
import {
  ExpenseTransactionStatus,
  ExpenseTransactionType,
} from "@prisma/client";
import { expensePageForActor } from "@/lib/account/expenses";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import {
  AuthorizationError,
  requirePermission,
} from "@/lib/auth/authorization";
import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { ACCOUNT_ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { z } from "zod";
import { db } from "@/lib/db";

async function loadExpensePage(
  searchParams: Promise<Record<string, string | undefined>>,
) {
  try {
    const actor = await requirePermission("ACCOUNT_EXPENSE_VIEW");
    const query = await searchParams;
    const scoped = await resolveAccountBranchContext(
      { ...actor, companyId: actor.companyId! },
      { branchId: query.branchId, scope: query.scope },
    );
    const filters = {
      q: query.q || undefined,
      status: query.status || undefined,
      type: query.type || undefined,
      categoryId: query.categoryId || undefined,
      templateId: query.templateId || undefined,
      branchId:
        scoped.context.mode === "BRANCH" ? scoped.context.branchId : undefined,
      offset: query.offset ?? 0,
    };
    const data = await expensePageForActor(
      { ...actor, companyId: actor.companyId! },
      filters,
    );
    const categories = await db.expenseCategory.findMany({
      where: { companyId: actor.companyId!, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const canCreate =
      actor.accountRole &&
      ACCOUNT_ROLE_PERMISSIONS[actor.accountRole].includes(
        "ACCOUNT_EXPENSE_ENTRY",
      );
    const branches = new Map(scoped.branches.map((b) => [b.id, b.name]));
    const scopeQuery = scoped.context.mode === "BRANCH"
      ? `branchId=${scoped.context.branchId}`
      : "scope=all";
    const href = (offset: number) => {
      const params = new URLSearchParams();
      for (const key of [
        "q",
        "status",
        "type",
        "categoryId",
        "templateId",
        "branchId",
        "scope",
      ]) {
        if (query[key]) params.set(key, query[key]!);
      }
      for (const [key, value] of new URLSearchParams(scopeQuery)) params.set(key, value);
      params.set("offset", String(offset));
      return `/workspace/account/expenses?${params}`;
    };
    return {
      kind: "ready" as const,
      data,
      query,
      scoped,
      canCreate,
      branches,
      href,
      categories,
      scopeQuery,
      summary: data.summary,
    };
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      (error instanceof Error && error.message.startsWith("MODULE_DISABLED:"))
    )
      return { kind: "denied" as const };
    if (error instanceof z.ZodError) return { kind: "invalid" as const };
    throw error;
  }
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const result = await loadExpensePage(searchParams);
  if (result.kind === "denied")
    return (
      <section className="account-card" role="status">
        <h1>Expenses access unavailable</h1>
        <p>Your permission or module settings do not allow this page.</p>
        <Link href="/workspace/account">Back to Account</Link>
      </section>
    );
  if (result.kind === "invalid")
    return (
      <section className="account-card" role="alert">
        <h1>Invalid expense filters</h1>
        <p>Choose a supported type, status or page.</p>
        <Link href="/workspace/account/expenses">Reset expense filters</Link>
      </section>
    );
  const { data, query, scoped, canCreate, branches, href, categories, scopeQuery } = result;
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="Expenses & Other Income"
          backHref="/workspace/account"
        />
        <p>
          {canCreate && (
            <>
              <Link
                href={
                  scoped.context.mode === "BRANCH"
                    ? `/workspace/account/expenses/new?branchId=${scoped.context.branchId}`
                    : "/workspace/account/expenses/new?scope=all"
                }
              >
                New transaction
              </Link>{" "}
              ·{" "}
            </>
          )}
          <Link href="/workspace/account/expenses/categories">Categories</Link>{" "}
          · <Link href="/workspace/account/expenses/recurring">Recurring</Link>
        </p>
        <p>
          Scope:{" "}
          {scoped.context.mode === "COMPANY"
            ? "Company consolidated"
            : scoped.context.branchName}
        </p>
        {query.templateId && (
          <p>
            Recurring bills for the selected schedule ·{" "}
            <Link
              href={
                query.branchId
                  ? `/workspace/account/expenses?branchId=${query.branchId}`
                  : "/workspace/account/expenses"
              }
            >
              All expenses
            </Link>
          </p>
        )}
        <section aria-label="Recognized expense and income totals">
          <h2>Posted totals · all history</h2>
          <p>
            Expense: <ClientMoney value={result.summary.expense} /> · Other
            income: <ClientMoney value={result.summary.income} />
          </p>
          <p>
            {result.summary.recognition} Totals apply to all matching
            transactions, across every list page.
          </p>
        </section>
        <form method="get" className="expense-list-filters">
          {scoped.context.mode === "BRANCH" ? (
            <input type="hidden" name="branchId" value={scoped.context.branchId} />
          ) : (
            <input type="hidden" name="scope" value="all" />
          )}
          {query.templateId && (
            <input type="hidden" name="templateId" value={query.templateId} />
          )}
          <label>
            Search expenses
            <input
              name="q"
              defaultValue={query.q ?? ""}
              maxLength={160}
              placeholder="Number or reference"
            />
          </label>
          <label>
            Status
            <select name="status" defaultValue={query.status ?? ""}>
              <option value="">All statuses</option>
              {Object.values(ExpenseTransactionStatus).map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select name="type" defaultValue={query.type ?? ""}>
              <option value="">All types</option>
              {Object.values(ExpenseTransactionType).map((t) => (
                <option key={t} value={t}>
                  {t.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select name="categoryId" defaultValue={query.categoryId ?? ""}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <button>Apply filters</button>
        </form>
        {data.rows.length === 0 ? (
          <p role="status">
            No expenses match these filters.
            {canCreate && (
              <>
                {" "}
                <Link href={`/workspace/account/expenses/new?${scopeQuery}`}>
                  Add an expense
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          <div
            className="table-wrap"
            role="region"
            aria-label="Expense transactions"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Branch</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <Link href={`/workspace/account/expenses/${x.id}`}>
                        {x.transactionNumber}
                      </Link>
                    </td>
                    <td>{branches.get(x.branchId) ?? "Branch"}</td>
                    <td>{x.type}</td>
                    <td>{x.transactionDate.toISOString().slice(0, 10)}</td>
                    <td>{x.status}</td>
                    <td>{x.totalAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav aria-label="Expense pagination">
          <p>
            {data.rows.length
              ? `${data.offset + 1}–${data.offset + data.rows.length}`
              : "0"}{" "}
            of {data.total} transactions
          </p>
          {data.offset > 0 && (
            <Link href={href(Math.max(0, data.offset - data.limit))}>
              Previous page
            </Link>
          )}
          {data.nextOffset !== null && (
            <>
              {" "}
              · <Link href={href(data.nextOffset)}>Next page</Link>
            </>
          )}
        </nav>
      </section>
    </div>
  );
}
