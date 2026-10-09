import { Prisma } from "@prisma/client";
import { retrySerializable } from "./transaction-retry";
import { projectInput } from "./project-schemas";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { requireAccountModules } from "@/lib/account/modules";
import {
  createProjectInTx,
  projectCreationHash,
  authorizedProjectBranchIds,
  projectRecordScope,
  closeProjectForActor,
  getProjectForActor,
  getProjectFormOptionsForActor,
  type ProjectActor,
} from "@/lib/account/projects";

export type ManualProjectInput = {
  idempotencyKey?: string;
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
  const normalized = projectInput.omit({customerId: true}).parse(raw);
  const {idempotencyKey, ...fields} = normalized;
  const {branchId, name, siteName, siteAddress, siteContactName, siteContactPhone} = fields;
  const requestHash = idempotencyKey ? projectCreationHash("MANUAL_PROJECT", fields) : null;
  const ids = await authorizedProjectBranchIds(actor);

  const options = await getProjectFormOptionsForActor(actor);
  if (!options.branches.some((branch) => branch.id === branchId))
    throw new AuthorizationError();

  // Every manually-created project gets its own Account customer immediately.
  // Use the site/project name as the customer identity and keep the person's
  // name in contactPerson so the customer is easy to find in transaction forms.
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        if (idempotencyKey) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.companyId}:project-create:${idempotencyKey}`}))`;
          const existing = await tx.project.findUnique({where: {companyId_creationRequestKey: {companyId: actor.companyId, creationRequestKey: idempotencyKey}}});
          if (existing) {
            if (!(await tx.project.findFirst({where: {id: existing.id, ...projectRecordScope(actor, ids)}, select: {id: true}}))) throw new AuthorizationError();
            if (existing.creationRequestHash !== requestHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
            return existing;
          }
        }
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

        const project = await createProjectInTx(tx, actor, {...fields, customerId: customer.id});

        const updated = await tx.project.update({
          where: { id: project.id },
          data: { status: "ACTIVE", creationRequestKey: idempotencyKey, creationRequestHash: requestHash },
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
