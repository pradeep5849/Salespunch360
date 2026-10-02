import Link from "next/link";
import { projectDashboard } from "@/lib/account/projects";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { requirePermission } from "@/lib/auth/authorization";
import { reconcileWonLeadProjectsForActor } from "@/lib/leads/won-project";

const statusLabel = (status: string) => status === "ON_HOLD"
  ? "Hold"
  : ["COMPLETED", "CLOSED", "CANCELLED"].includes(status)
    ? "Completed"
    : "Active";

export const metadata = { title: "Projects" };

export default async function Page() {
  const actor = await requirePermission("ACCOUNT_PROJECTS");
  if (actor.companyId) await reconcileWonLeadProjectsForActor({ id: actor.id, companyId: actor.companyId });
  const {metrics,rows} = await projectDashboard();
  return <main className="employees-shell"><section className="employees-content">
    <WorkspacePageHeader title="Projects" backHref="/workspace/account"/>
    <section className="account-metric-grid">{[["Active Projects",metrics.activeProjects],["Projects Closed",metrics.projectsClosed],["Total Project Value",metrics.totalProjectValue],["Received",metrics.received],["Outstanding",metrics.outstanding]].map(([label,value])=><article className="account-card" key={label.toString()}><small>{label.toString()}</small><strong>{typeof value==="number"?value:`₹${value.toString()}`}</strong></article>)}</section>
    <section><h2>Quick Actions</h2><div className="account-quick-grid">{[["Project Invoice","/workspace/account/transactions/new?type=SALES_INVOICE&project=select"],["Move / Return Stock","/workspace/account/projects/material"],["Project Settings","/workspace/account/settings/modules"],["View All","/workspace/account/menu#projects"]].map(([label,href])=><Link className="account-card" href={href} key={label}>{label}</Link>)}</div></section>
    <section><h2>All Projects</h2><div className="table-wrap"><table><thead><tr><th>Project</th><th>Customer</th><th>Status</th><th>Project Value</th><th>Invoiced</th><th>Received</th><th>Outstanding</th><th/></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.customer.name}</td><td>{statusLabel(p.status)}</td><td>{p.finalProjectValue.toString()}</td><td>{p.invoiced.toString()}</td><td>{p.received.toString()}</td><td>{p.outstanding.toString()}</td><td><Link href={`/workspace/account/projects/${p.id}`} aria-label={`Open ${p.name}`}>›</Link></td></tr>)}</tbody></table></div></section>
    <Link className="account-project-fab" href="/workspace/account/projects/new">+ Create New Project</Link>
  </section></main>;
}
