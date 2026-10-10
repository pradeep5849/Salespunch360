import Link from "next/link";
import { projectDashboard } from "@/lib/account/projects";
import { requirePermission } from "@/lib/auth/authorization";
import { reconcileWonLeadProjectsForActor } from "@/lib/leads/won-project";
import { enabledModulesForCompany } from "@/lib/account/modules";
import { AccountIcon } from "@/components/account/account-icons";

const statusLabel = (status: string) => status === "ON_HOLD"
  ? "Hold"
  : status === "CLOSED"
    ? "Closed"
    : status === "CANCELLED"
      ? "Cancelled"
      : status === "COMPLETED"
        ? "Completed"
        : "Active";

export const metadata = { title: "Projects" };

export default async function Page() {
  const actor = await requirePermission("ACCOUNT_PROJECTS");
  if (actor.companyId) await reconcileWonLeadProjectsForActor({ id: actor.id, companyId: actor.companyId });
  const {metrics,rows} = await projectDashboard();
  const metricRows=[
    [["Active Projects",metrics.activeProjects],["Projects Closed",metrics.projectsClosed]],
    [["Received",`₹${metrics.received}`],["Outstanding",`₹${metrics.outstanding}`]],
  ];
  const modules = await enabledModulesForCompany(actor.companyId!);
  const quick=[
    ["Project Invoice","/workspace/account/transactions/new?type=SALES_INVOICE&project=select","report"],
    ["Move / Return Stock","/workspace/account/projects/material","items"],
    ["Project Settings","/workspace/account/settings/modules","settings"],
    ["View All","/workspace/account/projects/actions","grid"],
  ] as const;
  const visibleQuick = quick.filter(([label]) =>
    label === "Project Invoice" ? actor.accountRole === "ACCOUNT_ADMIN" && modules.includes("SALES") :
    label === "Project Settings" ? actor.accountRole === "ACCOUNT_ADMIN" : true);
  return <main className="projects-home">
    <header className="projects-root-title"><h1>Projects</h1></header>
    <section className="projects-summary" aria-label="Project summary">
      {metricRows.map((row,index)=><div className="projects-summary-row" key={index}>{row.map(([label,value])=><article className="account-card project-summary-card" key={String(label)}><span>{label}</span><strong>{String(value)}</strong></article>)}</div>)}
      <article className="account-card project-summary-card project-summary-total"><span>Total Project Value</span><strong>₹{metrics.totalProjectValue.toString()}</strong></article>
    </section>

    <section className="account-card projects-quick-card"><h2>Quick Links</h2><div className="projects-quick-grid">{visibleQuick.map(([label,href,icon])=><Link href={href} key={label}><span><AccountIcon name={icon}/></span><small>{label}</small></Link>)}</div></section>

    <section className="projects-list-section"><h2>All Projects</h2><div className="projects-card-list">{rows.length?rows.map(p=><Link className="account-card project-list-card" href={`/workspace/account/projects/${p.id}`} key={p.id}><div><strong>{p.name}</strong><small>{p.customer.name} · {statusLabel(p.status)}</small></div><dl><div><dt>Value</dt><dd>₹{p.finalProjectValue.toString()}</dd></div><div><dt>Invoiced</dt><dd>₹{p.invoiced.toString()}</dd></div><div><dt>Received</dt><dd>₹{p.received.toString()}</dd></div><div><dt>Outstanding</dt><dd>₹{p.outstanding.toString()}</dd></div></dl><b aria-hidden>›</b></Link>):<div className="account-card project-list-empty">No projects found.</div>}</div></section>
    <Link className="account-floating-action account-project-fab projects-root-fab" href="/workspace/account/projects/new">+ Create New Project</Link>
  </main>;
}
