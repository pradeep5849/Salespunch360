import { getProjectFormOptions } from "@/lib/account/projects";
import { requirePermission } from "@/lib/auth/authorization";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { ProjectForm } from "./project-form";
export default async function Page() { const actor = await requirePermission("ACCOUNT_PROJECTS"), options = await getProjectFormOptions(); return <main className="employees-shell"><section className="employees-content"><WorkspacePageHeader title="New project" backHref="/workspace/account/projects"/><ProjectForm branches={options.branches} managers={options.managers} accountAdmin={actor.accountRole === "ACCOUNT_ADMIN"}/></section></main>; }
