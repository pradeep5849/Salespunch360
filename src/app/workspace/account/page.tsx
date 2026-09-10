import Link from "next/link";
import { requireAccountWorkspace } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { canUsePermission } from "@/lib/auth/permissions";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
export const metadata={title:"Account workspace"};
export default async function AccountFoundationPage(){const actor=await requireAccountWorkspace();const company=await db.company.findUniqueOrThrow({where:{id:actor.companyId},select:{name:true,productEdition:true}});const users=canUsePermission(actor,company.productEdition,"ACCOUNT_USER_ADMIN");return <main className="employees-shell"><section className="employees-content"><WorkspacePageHeader title="Account workspace" backHref="/sign-in"/><h1>{company.name}</h1><p className="muted">Your Account workspace foundation is ready. Account business modules will be added in later phases.</p><nav className="employee-actions"><Link href="/workspace/change-password">My profile / password</Link><Link href="/workspace/company-profile">Company details</Link>{users&&<Link href="/workspace/employees">Company users</Link>}{actor.accountRole==="ACCOUNT_ADMIN"&&<Link href="/workspace/billing">Billing & Subscription</Link>}{actor.salesRole==="PRIMARY_ADMIN"&&<Link href="/workspace/branches">Branches</Link>}</nav></section></main>}
