import {
  dashboardLinks,
  signedTrendPercent,
} from "@/lib/account/dashboard-links";
import Link from "next/link";
import {
  AccountCard,
  AccountPageHeader,
} from "@/components/account/account-shell";
import { requirePermission } from "@/lib/auth/authorization";
import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { accountBranchDashboard } from "@/lib/account/branch-dashboard";
import { enabledModulesForCompany } from "@/lib/account/modules";
import { formatInr } from "@/lib/account/presentation";
import { db } from "@/lib/db";
import { dashboardCardVisibility } from "@/lib/account/dashboard-policy";
type Query = { branchId?: string; scope?: string; view?: string };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const rawActor = await requirePermission("ACCOUNT_DASHBOARD"),
    actor = { ...rawActor, companyId: rawActor.companyId! },
    query = await searchParams,
    resolved = await resolveAccountBranchContext(actor, {
      branchId: query.branchId,
      scope: query.scope,
    }),
    now = new Date(),
    year = await db.financialYear.findFirst({
      where: { companyId: actor.companyId, status: "OPEN" },
      orderBy: { startDate: "desc" },
      select: { name: true, startDate: true },
    }),
    from =
      year?.startDate ??
      new Date(
        Date.UTC(now.getUTCFullYear() - (now.getUTCMonth() < 3 ? 1 : 0), 3, 1),
      ),
    [data, modules] = await Promise.all([
      accountBranchDashboard(
        actor,
        resolved.context,
        from,
        now,
        query.view === "full" ? "FULL" : "SUMMARY",
      ),
      enabledModulesForCompany(actor.companyId),
    ]),
    title =
      resolved.context.mode === "COMPANY"
        ? "Company Consolidated Dashboard"
        : `${resolved.context.branchName} Dashboard`,
    period = year?.name ?? from.toLocaleDateString("en-IN");
  if (data.projectOnly)
    return (
      <>
        <AccountPageHeader
          title={title}
          subtitle={`Authorized Projects · ${period}`}
        />
        <section className="account-stat-grid">
          <AccountCard>
            <small>Assigned projects</small>
            <strong>{data.projects}</strong>
          </AccountCard>
          <AccountCard>
            <small>Project value</small>
            <strong>{formatInr(data.projectValue)}</strong>
          </AccountCard>
        </section>
      </>
    );
  const visible = dashboardCardVisibility(modules);
  const settings = await db.accountSettings.findUnique({
    where: { companyId: actor.companyId },
    select: { itemSettings: true },
  });
  const itemsEnabled =
    (settings?.itemSettings as { enabled?: boolean } | null)?.enabled !== false;
  const links = dashboardLinks(
    actor.accountRole,
    modules,
    itemsEnabled,
    resolved.context,
    from,
    now,
  );
  return (
    <>
      <AccountPageHeader
        title={title}
        subtitle={`Current Financial Year · ${period}`}
      />
      <div className="account-dashboard-modern">
        {visible.sales && (
          <AccountCard className="account-sale-overview">
            <small>SALE OVERVIEW · CURRENT MONTH</small>
            <h2>Sales revenue</h2>
            <strong>{formatInr(data.currentMonthSales)}</strong>
            <p>
              {data.salesGrowthPercent === null
                ? "Previous-period comparison becomes available after the first recorded month."
                : `${data.salesGrowthPercent.gte(0) ? "↑" : "↓"} ${data.salesGrowthPercent.abs().toString()}% from previous month`}
            </p>
            <div
              className="account-mini-chart"
              aria-label="Six month sales trend"
            >
              {data.salesTrend.map((point) => (
                <span key={point.month}>
                  <i
                    aria-hidden="true"
                    style={{
                      height: `${Math.abs(
                        signedTrendPercent(
                          point.total.toString(),
                          data.salesTrend.map((row) => row.total.toString()),
                        ),
                      )}%`,
                      background: point.total.lt(0) ? "#b42318" : undefined,
                    }}
                  />
                  <small>{point.month}</small>
                </span>
              ))}
            </div>
            <ul aria-label="Exact monthly sales values">
              {data.salesTrend.map((point) => (
                <li key={point.month}>
                  {point.month}: {formatInr(point.total)}
                </li>
              ))}
            </ul>
          </AccountCard>
        )}
        <section className="account-dashboard-pair">
          {visible.expenses && (
            <AccountCard>
              <small>EXPENSES</small>
              <h2>{formatInr(data.currentMonthExpenses)}</h2>
              <p>Posted this month</p>
            </AccountCard>
          )}
          <AccountCard>
            <small>CASH &amp; BANK</small>
            <h2>{formatInr(data.cashBank)}</h2>
            <p>
              Cash in hand: {formatInr(data.cash)} · Bank:{" "}
              {formatInr(data.bank)}
            </p>
            <p>
              Ledger-backed balance as of {now.toISOString().slice(0, 10)};
              includes inactive accounts with historical balances.
            </p>
            {links.cashBank && (
              <Link href={links.cashBank}>View cash and bank report →</Link>
            )}
          </AccountCard>
        </section>
        {visible.inventory && (
          <AccountCard className="account-inventory-overview">
            <small>INVENTORY</small>
            <h2>{formatInr(data.stockValue)}</h2>
            <div className="account-breakdown-row">
              <span>
                Tracked products <strong>{data.itemCount}</strong>
              </span>
              <span>
                Low-stock warehouse positions{" "}
                <strong>{data.lowStockItems}</strong>
              </span>
            </div>
            <p>Positions with recorded movements in active warehouses.</p>
            {data.lowStockPreview.map((row) => (
              <p key={`${row.productId}:${row.warehouseId}`}>
                {row.name} · {row.warehouse}: {row.quantity.toString()}
              </p>
            ))}
            {links.lowStock && <Link href={links.lowStock}>Low Stock →</Link>}{" "}
            {links.items && <Link href={links.items}>See all items →</Link>}
            {!itemsEnabled && (
              <p>Items navigation is disabled in General Settings.</p>
            )}
          </AccountCard>
        )}
        {links.reports && (
          <AccountCard className="account-reports-overview">
            <small>REPORTS</small>
            <h2>Understand your business</h2>
            <p>
              Open ledger-backed financial, sales, tax and inventory reports.
            </p>
            <Link href={links.reports}>See Reports →</Link>
          </AccountCard>
        )}
        {visible.expenses && (
          <AccountCard>
            <small>EXPENSE BREAKDOWN · CURRENT MONTH</small>
            <h2>Top categories</h2>
            {data.expenseBreakdown.length ? (
              data.expenseBreakdown.map((row) => (
                <div className="account-breakdown-row" key={row.categoryId}>
                  <span>{row.category}</span>
                  <strong>{formatInr(row.amount)}</strong>
                </div>
              ))
            ) : (
              <p>No posted expenses this month.</p>
            )}
            {links.expenseReport && (
              <Link href={links.expenseReport}>See expense report →</Link>
            )}
          </AccountCard>
        )}
        <AccountCard>
          <Link
            href={`?${new URLSearchParams({ ...(resolved.context.mode === "BRANCH" ? { branchId: resolved.context.branchId } : { scope: "all" }), view: query.view === "full" ? "summary" : "full" })}`}
          >
            {query.view === "full" ? "Hide" : "Show"} additional financial
            metrics
          </Link>
          {query.view === "full" && (
            <dl>
              <dt>Receivables</dt>
              <dd>{formatInr(data.receivables)}</dd>
              <dt>Vendor payables</dt>
              <dd>{formatInr(data.payables)}</dd>
              <dt>Financial-year profit</dt>
              <dd>{formatInr(data.profit)}</dd>
              {visible.sales && (
                <>
                  <dt>Financial-year sales</dt>
                  <dd>{formatInr(data.sales)}</dd>
                </>
              )}
              {visible.purchases && (
                <>
                  <dt>Financial-year purchases</dt>
                  <dd>{formatInr(data.purchases)}</dd>
                </>
              )}
              {visible.expenses && (
                <>
                  <dt>Financial-year expenses</dt>
                  <dd>{formatInr(data.expenses)}</dd>
                </>
              )}
              {visible.projects && (
                <>
                  <dt>Active projects</dt>
                  <dd>{data.projects}</dd>
                  <dt>Project value</dt>
                  <dd>{formatInr(data.projectValue)}</dd>
                </>
              )}
              {visible.inventory && (
                <>
                  <dt>Active warehouses</dt>
                  <dd>{data.warehouses}</dd>
                </>
              )}
            </dl>
          )}
        </AccountCard>
      </div>
      {resolved.context.mode === "COMPANY" &&
        (visible.sales || visible.expenses) && (
          <AccountCard>
            <h2>Branch comparison</h2>
            <div className="account-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Branch</th>
                    {visible.sales && <th>Sales</th>}
                    {visible.expenses && <th>Expenses</th>}
                    {visible.sales && visible.expenses && (
                      <th>Operating contribution</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.branchComparison.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      {visible.sales && <td>{formatInr(row.sales)}</td>}
                      {visible.expenses && <td>{formatInr(row.expenses)}</td>}
                      {visible.sales && visible.expenses && (
                        <td>{formatInr(row.operatingContribution)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccountCard>
        )}
    </>
  );
}
