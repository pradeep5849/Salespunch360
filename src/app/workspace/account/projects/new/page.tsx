import { getProjectFormOptions } from "@/lib/account/projects";
import { requirePermission } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { ProjectForm } from "./project-form";
export default async function Page() { const actor = await requirePermission("ACCOUNT_PROJECTS"), options = await getProjectFormOptions(), customers = await db.customer.findMany({ where: { companyId: actor.companyId!, isActive: true, isAccountCustomer: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }); return <main className="employees-shell"><section className="employees-content"><WorkspacePageHeader title="New project" backHref="/workspace/account/projects"/><ProjectForm branches={options.branches} customers={customers} managers={options.managers} accountAdmin={actor.accountRole === "ACCOUNT_ADMIN"}/></section></main>; }
