import { Prisma } from "@prisma/client";
import { retrySerializable } from "./transaction-retry";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { requireAccountModules } from "@/lib/account/modules";
import {
  createProjectInTx,
  closeProjectForActor,
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
  const siteName = String(raw.siteName ?? "").trim() || undefined;
  const siteAddress = String(raw.siteAddress ?? "").trim() || undefined;
  const siteContactName = String(raw.siteContactName ?? "").trim() || undefined;
  const siteContactPhone =
    String(raw.siteContactPhone ?? "").trim() || undefined;
  if (!branchId || !name) throw new Error("INVALID_PROJECT");

  const options = await getProjectFormOptionsForActor(actor);
  if (!options.branches.some((branch) => branch.id === branchId))
    throw new AuthorizationError();

  // Every manually-created project gets its own Account customer immediately.
  // Use the site/project name as the customer identity and keep the person's
  // name in contactPerson so the customer is easy to find in transaction forms.
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        const customer = await tx.customer.create({
          data: {
            companyId: actor.companyId,
            branchId,
            name: siteName || name,
            contactPerson: siteContactName,
            phone: siteContactPhone,
            address: siteAddress,
            isAccountCustomer: true,
          },
        });

        const project = await createProjectInTx(tx, actor, {
          branchId,
          name,
          customerId: customer.id,
          siteName,
          siteAddress,
          siteContactName,
          siteContactPhone,
          projectManagerId:
            String(raw.projectManagerId ?? "").trim() || undefined,
          startDate: String(raw.startDate ?? "").trim() || undefined,
          projectValue: String(raw.projectValue ?? "0").trim() || "0",
        });

        const updated = await tx.project.update({
          where: { id: project.id },
          data: { status: "ACTIVE" },
        });
        await tx.projectAuditEvent.create({
          data: {
            companyId: actor.companyId,
            projectId: project.id,
            actorUserId: actor.id,
            eventType: "PROJECT_STATUS_CHANGED",
            metadata: {
              from: "PLANNING",
              to: "ACTIVE",
              source: "MANUAL_CREATE",
            },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
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

  return closeProjectForActor(actor, projectId, {
    closureNote: "Completed via project workflow",
  });
}

export async function completeSimpleProject(projectId: string) {
  const actor = await requirePermissionForMutation("ACCOUNT_PROJECTS");
  if (!actor.companyId) throw new AuthorizationError();
  await requireAccountModules(actor, "PROJECTS");
  return completeSimpleProjectForActor(actor as ProjectActor, projectId);
}
