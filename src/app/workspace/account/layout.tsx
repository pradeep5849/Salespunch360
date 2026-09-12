import { AccountShell } from "@/components/account/account-shell";
import { requireAccountWorkspace } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { enabledModulesForCompany } from "@/lib/account/modules";
import { buildAccountNavigation } from "@/lib/account/navigation";
import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { webWorkspaceContext } from "@/lib/auth/web-workspace";

export default async function Layout({ children }: { children: React.ReactNode }) { const actor = await requireAccountWorkspace(); const [company, modules, branch, workspace] = await Promise.all([db.company.findUniqueOrThrow({ where: { id: actor.companyId }, select: { name: true, productEdition: true } }), enabledModulesForCompany(actor.companyId),resolveAccountBranchContext(actor),webWorkspaceContext(actor)]);const filter=branch.context.mode==="BRANCH"?{branchId:branch.context.branchId}:{};const pendingExpenses=await db.expenseTransaction.count({where:{companyId:actor.companyId,status:"PENDING_APPROVAL",...filter}}); const navigation = buildAccountNavigation(actor, company.productEdition, modules), context = branch.context.mode==="COMPANY"?"Company Consolidated":branch.context.branchName; return <AccountShell companyName={company.name} branchContext={context} branchContextValue={branch.context.mode==="COMPANY"?"all":branch.context.branchId} branches={branch.branches} canConsolidate={branch.canConsolidate} canSwitchWorkspace={workspace?.canSwitchWorkspace??false} userName={actor.name} role={actor.accountRole ?? "ACCOUNT"} notifications={pendingExpenses} navigation={navigation} showItems={modules.includes("INVENTORY")} showProjects={modules.includes("PROJECTS")}>{children}</AccountShell>; }
