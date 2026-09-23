import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { requireAccountModules } from "@/lib/account/modules";
import {
  createProjectForActor,
  getProjectForActor,
  getProjectFormOptionsForActor,
  type ProjectActor,
} from "@/lib/account/projects";

export type ManualProjectInput = {
  branchId?: string;
  name?: string;
  siteName?: string;
  siteAddress?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  projectManagerId?: string;
  startDate?: string;
  projectValue?: string;
};

const finalStatuses = new Set(["COMPLETED", "CLOSED", "CANCELLED"]);

export async function createSimpleProjectForActor(
  actor: ProjectActor,
  raw: ManualProjectInput,
) {
  const branchId = String(raw.branchId ?? "").trim();
  const name = String(raw.name ?? "").trim();
  const siteAddress = String(raw.siteAddress ?? "").trim() || undefined;
  const siteContactName = String(raw.siteContactName ?? "").trim() || undefined;
  const siteContactPhone = String(raw.siteContactPhone ?? "").trim() || undefined;
  if (!branchId || !name) throw new Error("INVALID_PROJECT");

  const options = await getProjectFormOptionsForActor(actor);
  if (!options.branches.some((branch) => branch.id === branchId))
    throw new AuthorizationError();

  const customer = await db.customer.create({
    data: {
      companyId: actor.companyId,
      branchId,
      name: siteContactName || name,
      contactPerson: siteContactName,
      phone: siteContactPhone,
      address: siteAddress,
      isAccountCustomer: true,
    },
  });

  try {
    const project = await createProjectForActor(actor, {
      branchId,
      name,
      customerId: customer.id,
      siteName: String(raw.siteName ?? "").trim() || undefined,
      siteAddress,
      siteContactName,
      siteContactPhone,
      projectManagerId: String(raw.projectManagerId ?? "").trim() || undefined,
      startDate: String(raw.startDate ?? "").trim() || undefined,
      projectValue: String(raw.projectValue ?? "0").trim() || "0",
    });

    await db.$transaction([
      db.project.update({
        where: { id: project.id },
        data: { status: "ACTIVE" },
      }),
      db.projectAuditEvent.create({
        data: {
          companyId: actor.companyId,
          projectId: project.id,
          actorUserId: actor.id,
          eventType: "PROJECT_STATUS_CHANGED",
          metadata: { from: "PLANNING", to: "ACTIVE", source: "MANUAL_CREATE" },
        },
      }),
    ]);
    return project;
  } catch (error) {
    await db.customer
      .deleteMany({ where: { id: customer.id, companyId: actor.companyId } })
      .catch(() => undefined);
    throw error;
  }
}

export async function createSimpleProject(raw: ManualProjectInput) {
  const actor = await requirePermissionForMutation("ACCOUNT_PROJECTS");
  if (!actor.companyId) throw new AuthorizationError();
  await requireAccountModules(actor, "PROJECTS");
  return createSimpleProjectForActor(actor as ProjectActor, raw);
}

export async function assertProjectEditableForActor(
  actor: ProjectActor,
  projectId: string,
) {
  const project = await getProjectForActor(actor, projectId);
  if (finalStatuses.has(project.status)) throw new Error("PROJECT_FINAL");
  return project;
}

export async function assertProjectEditable(projectId: string) {
  const actor = await requirePermissionForMutation("ACCOUNT_PROJECTS");
  if (!actor.companyId) throw new AuthorizationError();
  await requireAccountModules(actor, "PROJECTS");
  return assertProjectEditableForActor(actor as ProjectActor, projectId);
}

export async function completeSimpleProjectForActor(
  actor: ProjectActor,
  projectId: string,
) {
  const project = await getProjectForActor(actor, projectId);
  if (!["PLANNING", "ACTIVE", "ON_HOLD"].includes(project.status))
    throw new Error("PROJECT_FINAL");

  const now = new Date();
  return db.$transaction(async (tx) => {
    const updated = await tx.project.updateMany({
      where: {
        id: project.id,
        companyId: actor.companyId,
        status: project.status,
      },
      data: {
        // CLOSED is the existing backend's immutable/final state. The UI presents
        // it as Completed so all existing accounting/project guards stay active.
        status: "CLOSED",
        actualEndDate: now,
        closedById: actor.id,
        closedAt: now,
      },
    });
    if (updated.count !== 1) throw new Error("PROJECT_CHANGED");
    await tx.projectAuditEvent.create({
      data: {
        companyId: actor.companyId,
        projectId: project.id,
        actorUserId: actor.id,
        eventType: "PROJECT_STATUS_CHANGED",
        metadata: {
          from: project.status,
          to: "COMPLETED",
          storedStatus: "CLOSED",
        },
      },
    });
  });
}

export async function completeSimpleProject(projectId: string) {
  const actor = await requirePermissionForMutation("ACCOUNT_PROJECTS");
  if (!actor.companyId) throw new AuthorizationError();
  await requireAccountModules(actor, "PROJECTS");
  return completeSimpleProjectForActor(actor as ProjectActor, projectId);
}
