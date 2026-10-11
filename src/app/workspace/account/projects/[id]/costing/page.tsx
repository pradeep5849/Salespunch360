import { ClientMoney } from "@/components/account/display-preferences";
import { ProjectChangeOrders } from "@/components/account/project-change-orders";
import { ProjectFinancialDetails } from "@/components/account/project-financial-details";
import { requirePermission } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { enabledModulesForCompany } from "@/lib/account/modules";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import type { ProjectActor } from "@/lib/account/projects";
import { loadProjectCostingForActor } from "@/lib/account/project-costing";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
const money = (value: { toString(): string } | null) =>
  value === null ? "—" : <ClientMoney value={value.toString()} />;
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = (await requirePermission(
    "ACCOUNT_PROJECT_COST_VIEW",
  )) as ProjectActor;
  const modules = await enabledModulesForCompany(actor.companyId);
  if (!modules.includes("PROJECTS") || !modules.includes("PROJECT_COSTING"))
    notFound();
  const [{ project, metrics, changes, packages, details }, company] =
    await Promise.all([
      loadProjectCostingForActor(actor, id),
      db.company.findUniqueOrThrow({
        where: { id: actor.companyId },
        select: { productEdition: true },
      }),
    ]);
  const canEdit =
    !["COMPLETED", "CLOSED", "CANCELLED"].includes(project.status) &&
    canUsePermission(
      actor,
      company.productEdition,
      "ACCOUNT_PROJECT_COST_EDIT",
    );
  const groups = [
    {
      title: "Contract and revenue",
      cards: [
        ["Project Value / Gross Value", metrics.originalValue],
        [
          "Approved Change Orders (tax-exclusive)",
          metrics.approvedChangeOrders,
        ],
        ["Current Tax-exclusive Contract Revenue", metrics.contractRevenueBase],
        ["Project Revenue", metrics.revenue],
        [
          "Contract revenue remaining to invoice",
          metrics.unbilledContractRevenue,
        ],
      ],
    },
    {
      title: "Costs and materials",
      cards: [
        [
          "Net purchases / direct material cost",
          metrics.directProjectPurchases,
        ],
        ["Actual Cost", metrics.actualCost],
        ["Labour and other expenses", metrics.expenseCost],
        ["Material transferred in", metrics.materialTransferredIn],
        ["Material transferred out", metrics.materialTransferredOut],
      ],
    },
    {
      title: "Payments and outstanding",
      cards: [
        ["Advances received", metrics.advanceReceived],
        ["Payments applied to invoices", metrics.amountReceived],
        ["Customer invoice outstanding", metrics.accountingReceivable],
      ],
    },
    {
      title: "Profit",
      cards: [
        ["Contract amount less actual costs", metrics.contractProfit],
        ["Project P&L", metrics.profit],
        ...(metrics.finalProfit === null
          ? []
          : [["Final Profit", metrics.finalProfit] as const]),
      ],
    },
  ] as const;
  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title={`${project.projectNumber} · Profit & Loss`}
          backHref={`/workspace/account/projects/${id}`}
        />
        {groups.map(({ title, cards }) => (
          <section
            key={title}
            aria-label={title}
            id={title === "Profit" ? "report" : undefined}
          >
            <h2>{title}</h2>
            <div className="metric-grid">
              {cards.map(([label, value]) => (
                <article key={label}>
                  <b>{label}</b>
                  <p>{money(value)}</p>
                </article>
              ))}
              {title === "Profit" && (
                <article>
                  <b>Actual Margin %</b>
                  <p>{metrics.actualMarginPercent.toFixed(2)}%</p>
                </article>
              )}
            </div>
          </section>
        ))}
        <ProjectChangeOrders
          projectId={id}
          actorId={actor.id}
          canEdit={canEdit}
          canApprove={actor.accountRole === "ACCOUNT_ADMIN"}
          changes={changes.map((x) => ({
            id: x.id,
            title: x.title,
            description: x.description,
            changeOrderNumber: x.changeOrderNumber,
            valueDelta: x.valueDelta.toFixed(2),
            estimatedCostDelta: x.estimatedCostDelta.toFixed(2),
            status: x.status,
            createdById: x.createdById,
          }))}
        />
        <ProjectFinancialDetails details={details} />
        <details>
          <summary>Additional work/package analysis</summary>
          <h2>Work / Package Profitability</h2>
          {packages.length ? (
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
                      <td>{x.marginPercent.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No work packages recorded.</p>
          )}
        </details>
      </section>
    </main>
  );
}
