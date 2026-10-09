import { ProjectChangeOrders } from "@/components/account/project-change-orders";
import { requirePermission } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { enabledModulesForCompany } from "@/lib/account/modules";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import type { ProjectActor } from "@/lib/account/projects";
import { loadProjectCostingForActor } from "@/lib/account/project-costing";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
const money = (x: { toFixed(n: number): string } | null) =>
  x ? x.toFixed(2) : "—";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = (await requirePermission("ACCOUNT_PROJECT_COST_VIEW")) as ProjectActor;
  const modules = await enabledModulesForCompany(actor.companyId);
  if (!modules.includes("PROJECTS") || !modules.includes("PROJECT_COSTING")) notFound();
  const [{project, metrics, changes, packages, estimateSource}, company] = await Promise.all([
    loadProjectCostingForActor(actor, id), db.company.findUniqueOrThrow({where: {id: actor.companyId}, select: {productEdition: true}}),
  ]);
  const canEdit = !["COMPLETED", "CLOSED", "CANCELLED"].includes(project.status) && canUsePermission(actor, company.productEdition, "ACCOUNT_PROJECT_COST_EDIT");
  const cards = [
    ["Project Value / Gross Value", metrics.originalValue],
    ["Approved Change Orders (tax-exclusive)", metrics.approvedChangeOrders],
    ["Current Tax-exclusive Contract Revenue", metrics.contractRevenueBase],
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
        <ProjectChangeOrders projectId={id} actorId={actor.id} canEdit={canEdit} canApprove={actor.accountRole === "ACCOUNT_ADMIN"}
          changes={changes.map(x => ({id: x.id, title: x.title, description: x.description, changeOrderNumber: x.changeOrderNumber,
            valueDelta: x.valueDelta.toFixed(2), estimatedCostDelta: x.estimatedCostDelta.toFixed(2), status: x.status, createdById: x.createdById}))} />
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
