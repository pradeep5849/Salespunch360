import { z } from "zod";
import { canUsePermission } from "@/lib/auth/permissions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  getProjectForActor,
  getProjectFormOptionsForActor,
  listProjectsForActor,
  replaceBudgetForActor,
  updateProjectForActor,
  type ProjectActor,
} from "@/lib/account/projects";
import {
  assertProjectEditableForActor,
  completeSimpleProjectForActor,
  createSimpleProjectForActor,
} from "@/lib/account/project-simple-workflow";
import { loadProjectCostingForActor } from "@/lib/account/project-costing";
import { requireAccountModules } from "@/lib/account/modules";
import { mobileAccountActor } from "./account-transactions";
import type { MobileAppPrincipal } from "./auth";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const projectValue = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/).default("0");
const createInput = z
  .object({
    branchId: z.string().uuid(),
    name: z.string().trim().min(1).max(240),
    siteName: optionalText(240),
    siteAddress: optionalText(4000),
    siteContactName: optionalText(160),
    siteContactPhone: optionalText(30),
    projectManagerId: z.string().uuid().optional(),
    startDate: z.string().trim().optional(),
    projectValue,
  })
  .strict();
const updateInput = createInput
  .omit({ branchId: true })
  .extend({
    projectId: z.string().uuid(),
    status: z.enum(["ACTIVE", "ON_HOLD"]),
  })
  .strict();

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

function workflowStatus(status: string) {
  if (status === "ON_HOLD") return "ON_HOLD";
  if (["COMPLETED", "CLOSED", "CANCELLED"].includes(status)) return "COMPLETED";
  return "ACTIVE";
}

export async function mobileProjectList(
  u: MobileAppPrincipal,
  q?: string | null,
  status?: string | null,
) {
  const result = await listProjectsForActor(
    await permit(u, "ACCOUNT_PROJECTS"),
    { pageSize: "50" },
  );
  const rows = result.rows
    .map((x) => ({ ...x, status: workflowStatus(x.status) }))
    .filter(
      (x) =>
        (!status || x.status === status) &&
        (!q ||
          x.name.toLowerCase().includes(q.toLowerCase()) ||
          x.projectNumber.toLowerCase().includes(q.toLowerCase()) ||
          x.customer.name.toLowerCase().includes(q.toLowerCase())),
    );
  return { ...result, rows };
}

export async function mobileProjectDetail(u: MobileAppPrincipal, id: string) {
  return getProjectForActor(await permit(u, "ACCOUNT_PROJECTS"), id);
}

export async function mobileProjectOptions(u: MobileAppPrincipal, id?: string) {
  return getProjectFormOptionsForActor(await permit(u, "ACCOUNT_PROJECTS"), id);
}

export async function mobileCreateProject(u: MobileAppPrincipal, raw: unknown) {
  await assertOperationalWrite(u.companyId);
  const actor = (await permit(u, "ACCOUNT_PROJECTS")) as ProjectActor;
  return createSimpleProjectForActor(actor, createInput.parse(raw));
}

export async function mobileUpdateProject(u: MobileAppPrincipal, raw: unknown) {
  await assertOperationalWrite(u.companyId);
  const actor = (await permit(u, "ACCOUNT_PROJECTS")) as ProjectActor;
  const data = updateInput.parse(raw);
  await assertProjectEditableForActor(actor, data.projectId);
  await updateProjectForActor(actor, {
    ...data,
    targetEndDate: undefined,
  });
  return getProjectForActor(actor, data.projectId);
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
  const actor = (await permit(u, "ACCOUNT_PROJECTS")) as ProjectActor;
  const action = z.object({ action: z.literal("COMPLETE") }).strict().parse(raw);
  await completeSimpleProjectForActor(actor, id);
  void action;
  return getProjectForActor(actor, id);
}

export async function mobileProjectBudget(
  u: MobileAppPrincipal,
  id: string,
  raw: unknown,
) {
  await assertOperationalWrite(u.companyId);
  const actor = (await permit(u, "ACCOUNT_PROJECTS")) as ProjectActor;
  await assertProjectEditableForActor(actor, id);
  const d = raw as { lines?: unknown[] };
  await replaceBudgetForActor(actor, { projectId: id, lines: d.lines ?? [] });
  return getProjectForActor(actor, id);
}
