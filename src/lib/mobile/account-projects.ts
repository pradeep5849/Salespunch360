import { projectWorkflowCapabilities } from "@/lib/account/project-workflow-capabilities";
import { z } from "zod";
import { canUsePermission } from "@/lib/auth/permissions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  getProjectForActor,
  getProjectFormOptionsForActor,
  projectDashboardForActor,
  replaceBudgetForActor,
  updateProjectForActor,
  type ProjectActor,
} from "@/lib/account/projects";
import {
  assertProjectEditableForActor,
  completeSimpleProjectForActor,
  createSimpleProjectForActor,
} from "@/lib/account/project-simple-workflow";
import { createChangeOrderForActor, updateChangeOrderForActor, transitionChangeOrderForActor, loadProjectCostingForActor } from "@/lib/account/project-costing";
import { enabledModulesForCompany, requireAccountModules } from "@/lib/account/modules";
import { mobileAccountActor } from "./account-transactions";
import type { MobileAppPrincipal } from "./auth";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const projectValue = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/).default("0");
const createInput = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(120).optional(),
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
  .omit({ branchId: true, idempotencyKey: true })
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

// Project listing remains governed by listProjectsForActor scope through projectDashboardForActor.
export async function mobileProjectList(
  u: MobileAppPrincipal,
  q?: string | null,
  status?: string | null,
) {
  const actor=await permit(u,"ACCOUNT_PROJECTS"),dashboard=await projectDashboardForActor(actor),result={rows:dashboard.rows,page:1,pageSize:dashboard.rows.length,total:dashboard.rows.length,totalPages:1};
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
  return { ...result, rows, metrics:dashboard.metrics };
}

export async function mobileProjectDetail(u: MobileAppPrincipal, id: string) {
  return getProjectForActor(await permit(u, "ACCOUNT_PROJECTS"), id);
}

export async function mobileProjectOptions(u: MobileAppPrincipal, id?: string) {
  const actor = await permit(u, "ACCOUNT_PROJECTS");
  const [options, modules] = await Promise.all([
    getProjectFormOptionsForActor(actor, id), enabledModulesForCompany(actor.companyId),
  ]);
  return { ...options, capabilities: {
    workflow: projectWorkflowCapabilities(actor, u.productEdition, modules),
    invoiceCreate: modules.includes("SALES") && canUsePermission(actor, u.productEdition, "ACCOUNT_SALES_ENTRY") && canUsePermission(actor, u.productEdition, "ACCOUNT_JOURNAL_POST"),
    costView: modules.includes("PROJECT_COSTING") && canUsePermission(actor, u.productEdition, "ACCOUNT_PROJECT_COST_VIEW"),
    budgetEdit: canUsePermission(actor, u.productEdition, "ACCOUNT_PROJECT_COST_EDIT"),
    managerEditable: actor.accountRole === "ACCOUNT_ADMIN", actorId: actor.id,
  } };
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
  const actor = await permit(u, "ACCOUNT_PROJECT_COST_VIEW");
  const result = await loadProjectCostingForActor(actor, id);
  return {...result, capabilities: {
    edit: !["COMPLETED", "CLOSED", "CANCELLED"].includes(result.project.status) && canUsePermission(actor, u.productEdition, "ACCOUNT_PROJECT_COST_EDIT"),
    approve: actor.accountRole === "ACCOUNT_ADMIN", actorId: actor.id,
  }};
}

export async function mobileProjectAction(
  u: MobileAppPrincipal,
  id: string,
  raw: unknown,
) {
  await assertOperationalWrite(u.companyId);
  const actor = (await permit(u, "ACCOUNT_PROJECTS")) as ProjectActor;
  const action = z.object({ action: z.literal("COMPLETE"), billingServiceId: z.string().uuid().optional(), postingDate: z.coerce.date().optional() }).strict().parse(raw);
  await completeSimpleProjectForActor(actor, id, {billingServiceId: action.billingServiceId, postingDate: action.postingDate});
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

export async function mobileProjectChangeOrder(u: MobileAppPrincipal, projectId: string, raw: unknown) {
  await assertOperationalWrite(u.companyId);
  const actor = await permit(u, "ACCOUNT_PROJECTS");
  const request = z.discriminatedUnion("operation", [
    z.object({operation: z.literal("CREATE"), payload: z.object({title: z.string(), description: z.string().optional(), valueDelta: z.string(), estimatedCostDelta: z.string(), idempotencyKey: z.string().min(1).max(120)}).strict()}).strict(),
    z.object({operation: z.literal("EDIT"), payload: z.object({changeOrderId: z.string().uuid(), title: z.string(), description: z.string().optional(), valueDelta: z.string(), estimatedCostDelta: z.string()}).strict()}).strict(),
    z.object({operation: z.enum(["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"]), changeOrderId: z.string().uuid()}).strict(),
  ]).parse(raw);
  if (request.operation === "CREATE") await createChangeOrderForActor(actor, {...request.payload, projectId});
  else if (request.operation === "EDIT") await updateChangeOrderForActor(actor, {...request.payload, projectId});
  else await transitionChangeOrderForActor(actor, projectId, request.changeOrderId, request.operation);
  return mobileProjectCosting(u, projectId);
}
