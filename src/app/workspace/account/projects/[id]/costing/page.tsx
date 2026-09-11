import { changeOrderAction } from "@/app/actions/project-costing";
import { loadProjectCosting } from "@/lib/account/project-costing";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
const money = (x: { toFixed(n: number): string } | null) =>
  x ? x.toFixed(2) : "—";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    { project, metrics, changes, packages, estimateSource } =
      await loadProjectCosting(id);
  const cards = [
    ["Project Value / Gross Value", metrics.originalValue],
    ["Approved Change Orders", metrics.currentValue.sub(metrics.originalValue)],
    ["Current Gross Contract Value", metrics.currentValue],
    ["Tax-exclusive Contract Revenue", metrics.contractRevenueBase],
    [`Estimated Cost (${estimateSource})`, metrics.estimatedCost],
    [
      "Budget",
      project.budgetLines.reduce(
        (a, x) => a.add(x.amount),
        metrics.originalValue.mul(0),
      ),
    ],
    ["Actual Cost", metrics.actualCost],
    ["Committed Cost", metrics.committedCost],
    ["Remaining Forecast", metrics.remainingForecast],
    ["Forecast Final Cost", metrics.forecastCost],
    ["Budget Variance", metrics.budgetVariance],
    ["Project Revenue", metrics.revenue],
    ["Project P&L", metrics.profit],
    ["Expected Profit", metrics.expectedProfit],
    ["Forecast Profit", metrics.forecastProfit],
    ["Final Profit", metrics.finalProfit],
    ["Expected Margin %", metrics.expectedMarginPercent],
    ["Forecast Margin %", metrics.forecastMarginPercent],
    ["Actual Margin %", metrics.actualMarginPercent],
  ] as const;
  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title={`${project.projectNumber} · Costing`}
          backHref={`/workspace/account/projects/${id}`}
        />
        <div className="metric-grid">
          {cards.map(([label, value]) => (
            <article key={label}>
              <b>{label}</b>
              <p>{money(value)}</p>
            </article>
          ))}
        </div>
        <h2>Change Orders</h2>
        <form action={changeOrderAction} className="stack">
          <input type="hidden" name="operation" value="create" />
          <input type="hidden" name="projectId" value={id} />
          <input name="title" placeholder="Title" required />
          <textarea name="description" placeholder="Description" />
          <input name="valueDelta" placeholder="Value change" required />
          <input
            name="estimatedCostDelta"
            placeholder="Estimated cost change"
            required
          />
          <button>Create draft</button>
        </form>
        {changes.map((x) => (
          <article key={x.id}>
            <b>
              {x.changeOrderNumber} · {x.title}
            </b>
            <p>
              {x.status} · Value {money(x.valueDelta)} · Cost{" "}
              {money(x.estimatedCostDelta)}
            </p>
            {x.status === "DRAFT" && (
              <form action={changeOrderAction}>
                <input type="hidden" name="projectId" value={id} />
                <input type="hidden" name="changeOrderId" value={x.id} />
                <button name="operation" value="PENDING_APPROVAL">
                  Submit
                </button>
                <button name="operation" value="CANCELLED">
                  Cancel
                </button>
              </form>
            )}
            {x.status === "PENDING_APPROVAL" && (
              <form action={changeOrderAction}>
                <input type="hidden" name="projectId" value={id} />
                <input type="hidden" name="changeOrderId" value={x.id} />
                <button name="operation" value="APPROVED">
                  Approve
                </button>
                <button name="operation" value="REJECTED">
                  Reject
                </button>
                <button name="operation" value="CANCELLED">
                  Cancel
                </button>
              </form>
            )}
          </article>
        ))}
        <h2>Work / Package Profitability</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Package</th>
                <th>Estimated Revenue</th>
                <th>Estimated Cost</th>
                <th>Actual Revenue</th>
                <th>Actual Cost</th>
                <th>Profit</th>
                <th>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((x) => (
                <tr key={x.id ?? "other"}>
                  <td>{x.name}</td>
                  <td>{money(x.estimatedRevenue)}</td>
                  <td>{money(x.estimatedCost)}</td>
                  <td>{money(x.actualRevenue)}</td>
                  <td>{money(x.actualCost)}</td>
                  <td>{money(x.profit)}</td>
                  <td>{money(x.marginPercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
