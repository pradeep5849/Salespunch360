import Link from "next/link";
import { selectAccountBranch, switchWorkspace } from "@/app/actions/workspace-context";
import { requireAccountWorkspace } from "@/lib/auth/authorization";
import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { enabledModulesForCompany } from "@/lib/account/modules";
import { accountNavSectionId, buildAccountNavigation, type AccountNavGroup } from "@/lib/account/navigation";
import { webWorkspaceContext } from "@/lib/auth/web-workspace";
import { db } from "@/lib/db";

export default async function Page() {
  const actor = await requireAccountWorkspace();
  const [company, modules, branch, workspace] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: actor.companyId }, select: { productEdition: true } }),
    enabledModulesForCompany(actor.companyId), resolveAccountBranchContext(actor), webWorkspaceContext(actor),
  ]);
  const navigation = buildAccountNavigation(actor, company.productEdition, modules);
  const expandable = (group: AccountNavGroup) => <details key={group.label}><summary><span className="account-menu-icon" aria-hidden>{group.label === "Sales" ? "↗" : "↙"}</span>{group.label}<i>⌄</i></summary><nav>{group.items.map(item => <Link href={item.href} key={item.href + item.label}>{item.label}<span>›</span></Link>)}</nav></details>;
  return <div className="account-menu-page">
    <h1 className="sr-only">Account Menu</h1>
    <section className="account-promo" aria-label="SalesPunch360 announcement"><span>SalesPunch360</span><strong>Run your business with clarity.</strong><p>Explore the tools already included in your workspace.</p></section>
    {navigation.map(group => <section className="account-menu-section" key={group.label} id={accountNavSectionId(group.label)}><h2>{group.label}</h2>{group.children?.map(expandable)}{group.items.length > 0 && <nav>{group.items.map(item => <Link href={item.href} key={item.href + item.label}><span className="account-menu-icon" aria-hidden>•</span>{item.label}<i>›</i></Link>)}</nav>}</section>)}
    {branch.branches.length > 1 && <section className="account-menu-section"><h2>Branch</h2><form action={selectAccountBranch} className="account-menu-choices">{branch.branches.map(item => <button name="context" value={item.id} key={item.id} aria-current={branch.context.mode === "BRANCH" && branch.context.branchId === item.id ? "true" : undefined}>{item.name}<span>{branch.context.mode === "BRANCH" && branch.context.branchId === item.id ? "✓" : "›"}</span></button>)}{branch.canConsolidate && <button name="context" value="all" aria-current={branch.context.mode === "COMPANY" ? "true" : undefined}>All Branches<span>{branch.context.mode === "COMPANY" ? "✓" : "›"}</span></button>}</form></section>}
    {workspace?.canSwitchWorkspace && <section className="account-menu-section"><h2>Workspace</h2><form action={switchWorkspace} className="account-menu-choices"><input type="hidden" name="workspace" value="SALES"/><button>Switch to Sales<span>›</span></button></form></section>}
  </div>;
}
