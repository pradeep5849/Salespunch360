import { canUsePermission } from "@/lib/auth/permissions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  closeProjectForActor,
  createProjectForActor,
  getProjectForActor,
  getProjectFormOptionsForActor,
  listProjectsForActor,
  reopenProjectForActor,
  updateProjectForActor,
} from "@/lib/account/projects";
import { loadProjectCostingForActor } from "@/lib/account/project-costing";
import { requireAccountModules } from "@/lib/account/modules";
import { db } from "@/lib/db";
import { mobileAccountActor } from "./account-transactions";
import type { MobileAppPrincipal } from "./auth";
async function permit(
  u: MobileAppPrincipal,
  p: "ACCOUNT_PROJECTS" | "ACCOUNT_PROJECT_COST_VIEW",
) {
  const a = mobileAccountActor(u);
  if (!canUsePermission(a, u.productEdition, p))
    throw new Error("MOBILE_FORBIDDEN");
  if (p === "ACCOUNT_PROJECT_COST_VIEW")
    await requireAccountModules(a, "PROJECTS", "PROJECT_COSTING");
  else await requireAccountModules(a, "PROJECTS");
  return a;
}
export async function mobileProjectList(
  u: MobileAppPrincipal,
  q?: string | null,
  status?: string | null,
) {
  const result = await listProjectsForActor(
    await permit(u, "ACCOUNT_PROJECTS"),
    {
      pageSize: "50",
    },
  );
  return {
    ...result,
    rows: result.rows.filter(
      (x) =>
        (!status || x.status === status) &&
        (!q ||
          x.name.toLowerCase().includes(q.toLowerCase()) ||
          x.projectNumber.toLowerCase().includes(q.toLowerCase()) ||
          x.customer.name.toLowerCase().includes(q.toLowerCase())),
    ),
  };
}
export async function mobileProjectDetail(u: MobileAppPrincipal, id: string) {
  return getProjectForActor(await permit(u, "ACCOUNT_PROJECTS"), id);
}
export async function mobileProjectOptions(u: MobileAppPrincipal, id?: string) {
  const a = await permit(u, "ACCOUNT_PROJECTS"),
    base = await getProjectFormOptionsForActor(a, id),
    customers = await db.customer.findMany({
      where: {
        companyId: a.companyId,
        isActive: true,
        isAccountCustomer: true,
        branchId: { in: base.branches.map((x) => x.id) },
      },
      select: { id: true, name: true, branchId: true },
      orderBy: { name: "asc" },
    });
  return { ...base, customers };
}
export async function mobileCreateProject(u: MobileAppPrincipal, raw: unknown) {
  await assertOperationalWrite(u.companyId);
  return createProjectForActor(await permit(u, "ACCOUNT_PROJECTS"), raw);
}
export async function mobileUpdateProject(u: MobileAppPrincipal, raw: unknown) {
  await assertOperationalWrite(u.companyId);
  const a = await permit(u, "ACCOUNT_PROJECTS");
  await updateProjectForActor(a, raw);
  return getProjectForActor(
    a,
    (raw as { id: string; projectId: string }).projectId,
  );
}
export async function mobileProjectCosting(u: MobileAppPrincipal, id: string) {
  return loadProjectCostingForActor(
    await permit(u, "ACCOUNT_PROJECT_COST_VIEW"),
    id,
  );
}

export async function mobileProjectAction(
  u: MobileAppPrincipal,
  id: string,
  raw: unknown,
) {
  await assertOperationalWrite(u.companyId);
  const a = await permit(u, "ACCOUNT_PROJECTS"),
    d = raw as { action?: string; closureNote?: string };
  if (d.action === "CLOSE")
    await closeProjectForActor(a, id, { closureNote: d.closureNote });
  else if (d.action === "REOPEN") await reopenProjectForActor(a, id);
  else throw new Error("INVALID_INPUT");
  return getProjectForActor(a, id);
}
