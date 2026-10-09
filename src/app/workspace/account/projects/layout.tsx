import { notFound } from "next/navigation";
import { requireAccountWorkspace } from "@/lib/auth/authorization";
import { enabledModulesForCompany } from "@/lib/account/modules";

/** Page access complements the authoritative guards on every Project service. */
export default async function ProjectLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireAccountWorkspace();
  const modules = await enabledModulesForCompany(actor.companyId);
  if (!modules.includes("PROJECTS")) notFound();
  return children;
}
