import { randomUUID } from "node:crypto";
import {
  Prisma,
  ProjectAuditEventType,
  ProjectMilestoneStatus,
  ProjectStatus,
  ProjectTaskStatus,
  type ProductEdition,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { enabledModulesForCompany, requireAccountModules } from "./modules";
import { allocateDocumentNumberInTx } from "./numbering";
import { privateStorage } from "@/lib/storage";

const money = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/);
const optionalText = (length: number) =>
  z.string().trim().max(length).optional();
const optionalUuid = z.string().uuid().optional();
const operationalStatuses = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;

export const projectInput = z
  .object({
    branchId: z.string().uuid(),
    name: z.string().trim().min(1).max(240),
    customerId: z.string().uuid(),
    siteName: optionalText(240),
    siteAddress: optionalText(4000),
    siteContactName: optionalText(160),
    siteContactPhone: optionalText(30),
    projectManagerId: optionalUuid,
    startDate: z.coerce.date().optional(),
    targetEndDate: z.coerce.date().optional(),
    projectValue: money.default("0"),
  })
  .strict();
export const projectUpdateInput = projectInput
  .omit({ branchId: true, customerId: true })
  .extend({ projectId: z.string().uuid(), status: z.enum(operationalStatuses) })
  .strict();
export const projectStatusInput = z
  .object({ projectId: z.string().uuid(), status: z.nativeEnum(ProjectStatus) })
  .strict();
export const budgetInput = z
  .object({
    projectId: z.string().uuid(),
    lines: z
      .array(
        z
          .object({
            category: z.string().trim().min(1).max(120),
            title: z.string().trim().min(1).max(240),
            description: optionalText(2000),
            amount: money,
          })
          .strict(),
      )
      .max(250),
  })
  .strict();
const milestoneFields = z
  .object({
    title: z.string().trim().min(1).max(240),
    description: optionalText(2000),
    startDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
    status: z.nativeEnum(ProjectMilestoneStatus).default("PENDING"),
  })
  .strict();
export const milestoneInput = milestoneFields
  .extend({ projectId: z.string().uuid() })
  .strict();
export const milestoneUpdateInput = milestoneFields
  .extend({ projectId: z.string().uuid(), milestoneId: z.string().uuid() })
  .strict();
const taskFields = z
  .object({
    milestoneId: optionalUuid,
    title: z.string().trim().min(1).max(240),
    description: optionalText(2000),
    assigneeUserId: optionalUuid,
    dueDate: z.coerce.date().optional(),
    priority: z.coerce.number().int().min(0).max(3).default(0),
    status: z.nativeEnum(ProjectTaskStatus).default("TODO"),
  })
  .strict();
export const taskInput = taskFields
  .extend({ projectId: z.string().uuid() })
  .strict();
export const taskUpdateInput = taskFields
  .extend({ projectId: z.string().uuid(), taskId: z.string().uuid() })
  .strict();

export type ProjectActor = Awaited<
  ReturnType<typeof requirePermissionForMutation>
> & { companyId: string };
type ProjectAccessActor = Pick<
  ProjectActor,
  | "id"
  | "companyId"
  | "accountRole"
  | "branchAccessScope"
  | "branchIds"
  | "isActive"
  | "role"
  | "salesRole"
  | "accountAccessActive"
  | "salesAccessActive"
  | "managerType"
>;

async function projectActor(mutation: boolean) {
  const value = mutation
    ? await requirePermissionForMutation("ACCOUNT_PROJECTS")
    : await requirePermission("ACCOUNT_PROJECTS");
  if (!value.companyId) throw new AuthorizationError();
  if (mutation) await requireAccountModules(value, "PROJECTS");
  return { ...value, companyId: value.companyId } as ProjectActor;
}

export async function authorizedProjectBranchIds(actor: ProjectAccessActor) {
  if (actor.branchAccessScope === "ALL_BRANCHES")
    return (
      await db.branch.findMany({
        where: { companyId: actor.companyId, isActive: true },
        select: { id: true },
      })
    ).map(({ id }) => id);
  return (
    await db.userBranchAccess.findMany({
      where: {
        userId: actor.id,
        branch: { companyId: actor.companyId, isActive: true },
      },
      select: { branchId: true },
    })
  ).map(({ branchId }) => branchId);
}
export function projectRecordScope(
  actor: Pick<ProjectAccessActor, "id" | "companyId" | "accountRole">,
  branchIds: string[],
): Prisma.ProjectWhereInput {
  return {
    companyId: actor.companyId,
    branchId: { in: branchIds },
    ...(actor.accountRole === "PROJECT_MANAGER"
      ? {
          OR: [
            { projectManagerId: actor.id },
            { members: { some: { userId: actor.id } } },
          ],
        }
      : {}),
  };
}
async function assertProjectCapability(actor: ProjectAccessActor) {
  const company = await db.company.findUnique({
    where: { id: actor.companyId },
    select: { productEdition: true },
  });
  if (
    !company ||
    !canUsePermission(actor, company.productEdition, "ACCOUNT_PROJECTS")
  )
    throw new AuthorizationError();
  await requireAccountModules(actor, "PROJECTS");
}
export function nextCompletionAt(
  status: "COMPLETED" | string,
  current: Date | null,
  now = new Date(),
) {
  return status === "COMPLETED" ? (current ?? now) : null;
}
export function projectCustomerWhere(
  companyId: string,
  branchId: string,
  customerId: string,
): Prisma.CustomerWhereInput {
  return {
    id: customerId,
    companyId,
    branchId,
    isActive: true,
    isAccountCustomer: true,
  };
}
export async function listOpenProjectOptionsForActor(
  actor: ProjectAccessActor,
  edition?: ProductEdition,
) {
  const enabled = await enabledModulesForCompany(actor.companyId);
  const productEdition =
    edition ??
    (
      await db.company.findUnique({
        where: { id: actor.companyId },
        select: { productEdition: true },
      })
    )?.productEdition;
  if (
    !enabled.includes("PROJECTS") ||
    !productEdition ||
    !canUsePermission(actor, productEdition, "ACCOUNT_PROJECTS")
  )
    return [];
  const ids = await authorizedProjectBranchIds(actor);
  return db.project.findMany({
    where: {
      ...projectRecordScope(actor, ids),
      status: { notIn: ["CLOSED", "CANCELLED"] },
    },
    select: {
      id: true,
      projectNumber: true,
      name: true,
      customerId: true,
      branchId: true,
      status: true,
    },
    orderBy: [{ projectNumber: "asc" }, { name: "asc" }],
  });
}
export async function authorizeProjectForCommercial(
  actor: ProjectAccessActor,
  projectId: string,
  branchId: string,
  customerId?: string,
  client: Prisma.TransactionClient | typeof db = db,
) {
  await assertProjectCapability(actor);
  const ids = await authorizedProjectBranchIds(actor);
  if (!ids.includes(branchId)) throw new AuthorizationError();
  if (client !== db)
    await client.$queryRaw`SELECT "id" FROM "projects" WHERE "id"=${projectId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const project = await client.project.findFirst({
    where: {
      id: projectId,
      branchId,
      ...projectRecordScope(actor, ids),
      status: { notIn: ["CLOSED", "CANCELLED"] },
      ...(customerId ? { customerId } : {}),
    },
    select: {
      id: true,
      projectNumber: true,
      name: true,
      customerId: true,
      branchId: true,
      status: true,
    },
  });
  if (!project) throw new AuthorizationError();
  return project;
}
async function audit(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  projectId: string,
  eventType: ProjectAuditEventType,
  metadata?: Prisma.InputJsonValue,
) {
  await tx.projectAuditEvent.create({
    data: {
      companyId: actor.companyId,
      projectId,
      actorUserId: actor.id,
      eventType,
      metadata,
    },
  });
}
async function mutable(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  id: string,
  branchIds: string[],
) {
  await tx.$queryRaw`SELECT "id" FROM "projects" WHERE "id"=${id}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const project = await tx.project.findFirst({
    where: { id, ...projectRecordScope(actor, branchIds) },
  });
  if (!project) throw new AuthorizationError();
  if (["CLOSED", "CANCELLED"].includes(project.status))
    throw new Error("PROJECT_CLOSED");
  return project;
}
async function validateManager(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  userId: string | undefined,
  branchId: string,
) {
  if (!userId) return;
  const user = await tx.user.findFirst({
    where: {
      id: userId,
      companyId: actor.companyId,
      isActive: true,
      accountAccessActive: true,
      accountRole: { in: ["ACCOUNT_ADMIN", "PROJECT_MANAGER"] },
      OR: [
        { branchAccessScope: "ALL_BRANCHES" },
        { branchAccesses: { some: { branchId } } },
      ],
    },
    select: { id: true },
  });
  if (!user) throw new Error("INVALID_PROJECT_MANAGER");
}
async function validateTaskRelations(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  projectId: string,
  milestoneId?: string,
  assigneeUserId?: string,
) {
  if (
    milestoneId &&
    !(await tx.projectMilestone.findFirst({
      where: { id: milestoneId, companyId: actor.companyId, projectId },
    }))
  )
    throw new Error("INVALID_MILESTONE");
  if (
    assigneeUserId &&
    !(await tx.projectMember.findFirst({
      where: {
        companyId: actor.companyId,
        projectId,
        userId: assigneeUserId,
        user: {
          isActive: true,
          accountAccessActive: true,
          accountRole: { in: ["ACCOUNT_ADMIN", "PROJECT_MANAGER"] },
        },
      },
    }))
  )
    throw new Error("INVALID_TASK_ASSIGNEE");
}

export async function createProjectForActor(actor: ProjectActor, raw: unknown) {
  const parsed = projectInput.parse(raw),
    ids = await authorizedProjectBranchIds(actor);
  if (!ids.includes(parsed.branchId)) throw new AuthorizationError();
  const data =
    actor.accountRole === "PROJECT_MANAGER"
      ? { ...parsed, projectManagerId: actor.id }
      : parsed;
  return db.$transaction(
    async (tx) => {
      const [branch, customer] = await Promise.all([
        tx.branch.findFirst({
          where: {
            id: data.branchId,
            companyId: actor.companyId,
            isActive: true,
          },
        }),
        tx.customer.findFirst({
          where: projectCustomerWhere(
            actor.companyId,
            data.branchId,
            data.customerId,
          ),
        }),
      ]);
      if (!branch) throw new Error("INVALID_BRANCH");
      if (!customer) throw new Error("INVALID_CUSTOMER");
      await validateManager(tx, actor, data.projectManagerId, data.branchId);
      const projectNumber = await allocateDocumentNumberInTx(tx, {
        companyId: actor.companyId,
        branchId: data.branchId,
        seriesKey: "PROJECT",
        defaults: { prefix: "PRJ-", padding: 6 },
      });
      const project = await tx.project.create({
        data: {
          companyId: actor.companyId,
          projectNumber,
          createdById: actor.id,
          ...data,
          projectValue: new Prisma.Decimal(data.projectValue),
          members: data.projectManagerId
            ? {
                create: {
                  userId: data.projectManagerId,
                  role: "PROJECT_MANAGER",
                },
              }
            : undefined,
        },
      });
      await audit(tx, actor, project.id, "PROJECT_CREATED");
      return project;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function updateProjectForActor(actor: ProjectActor, raw: unknown) {
  const data = projectUpdateInput.parse(raw),
    ids = await authorizedProjectBranchIds(actor);
  return db.$transaction(
    async (tx) => {
      const project = await mutable(tx, actor, data.projectId, ids);
      if (
        actor.accountRole === "PROJECT_MANAGER" &&
        data.projectManagerId !== actor.id
      )
        throw new AuthorizationError();
      await validateManager(tx, actor, data.projectManagerId, project.branchId);
      if (data.status !== project.status)
        assertNormalProjectTransition(project.status, data.status);
      const value = new Prisma.Decimal(data.projectValue),
        managerChanged =
          (data.projectManagerId ?? null) !== project.projectManagerId;
      await tx.project.update({
        where: { id: project.id },
        data: {
          name: data.name,
          siteName: data.siteName,
          siteAddress: data.siteAddress,
          siteContactName: data.siteContactName,
          siteContactPhone: data.siteContactPhone,
          startDate: data.startDate,
          targetEndDate: data.targetEndDate,
          projectValue: value,
          projectManagerId: data.projectManagerId ?? null,
          status: data.status,
        },
      });
      if (
        managerChanged &&
        project.projectManagerId &&
        project.projectManagerId !== data.projectManagerId
      )
        await tx.projectMember.updateMany({
          where: {
            companyId: actor.companyId,
            projectId: project.id,
            userId: project.projectManagerId,
            role: "PROJECT_MANAGER",
          },
          data: { role: "MEMBER" },
        });
      if (data.projectManagerId)
        await tx.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId: project.id,
              userId: data.projectManagerId,
            },
          },
          create: {
            companyId: actor.companyId,
            projectId: project.id,
            userId: data.projectManagerId,
            role: "PROJECT_MANAGER",
          },
          update: { role: "PROJECT_MANAGER" },
        });
      await audit(tx, actor, project.id, "PROJECT_UPDATED", {
        projectValue: {
          from: project.projectValue.toString(),
          to: value.toString(),
        },
      });
      if (managerChanged)
        await audit(tx, actor, project.id, "PROJECT_MANAGER_CHANGED", {
          from: project.projectManagerId,
          to: data.projectManagerId ?? null,
        });
      if (data.status !== project.status)
        await audit(tx, actor, project.id, "PROJECT_STATUS_CHANGED", {
          from: project.status,
          to: data.status,
        });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export function assertNormalProjectTransition(
  from: ProjectStatus,
  to: ProjectStatus,
) {
  const allowed: Record<ProjectStatus, ProjectStatus[]> = {
    PLANNING: ["ACTIVE", "CANCELLED"],
    ACTIVE: ["ON_HOLD", "COMPLETED", "CANCELLED"],
    ON_HOLD: ["ACTIVE", "CANCELLED"],
    COMPLETED: ["ACTIVE", "CANCELLED"],
    CLOSED: [],
    CANCELLED: [],
  };
  if (!allowed[from].includes(to) || to === "CLOSED")
    throw new Error("INVALID_PROJECT_STATUS_TRANSITION");
}
export const PROJECT_PAGE_SIZE = 25;
export const PROJECT_MAX_PAGE_SIZE = 50;
export function projectPageInput(
  raw: { page?: string; pageSize?: string } = {},
) {
  const page = Math.max(
    1,
    Number.isSafeInteger(Number(raw.page)) ? Number(raw.page) : 1,
  );
  const requested = Number(raw.pageSize);
  const pageSize = Math.min(
    PROJECT_MAX_PAGE_SIZE,
    Math.max(
      1,
      Number.isSafeInteger(requested) ? requested : PROJECT_PAGE_SIZE,
    ),
  );
  return { page, pageSize };
}
export async function listProjectsForActor(
  actor: ProjectActor,
  raw: { page?: string; pageSize?: string } = {},
) {
  const ids = await authorizedProjectBranchIds(actor),
    paging = projectPageInput(raw),
    where = projectRecordScope(actor, ids);
  const [rows, total] = await Promise.all([
    db.project.findMany({
      where,
      select: {
        id: true,
        projectNumber: true,
        name: true,
        status: true,
        projectValue: true,
        startDate: true,
        targetEndDate: true,
        customer: { select: { name: true } },
        branch: { select: { name: true } },
        projectManager: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (paging.page - 1) * paging.pageSize,
      take: paging.pageSize,
    }),
    db.project.count({ where }),
  ]);
  return {
    rows,
    ...paging,
    total,
    totalPages: Math.max(1, Math.ceil(total / paging.pageSize)),
  };
}
export function deriveProjectPaymentTotal(
  documents: Array<{
    type: string;
    allocations: Array<{ amount: Prisma.Decimal }>;
    advanceApplications: Array<{ amount: Prisma.Decimal }>;
  }>,
  type: string,
) {
  return documents
    .filter((document) => document.type === type)
    .reduce(
      (sum, document) =>
        sum
          .add(
            document.allocations.reduce(
              (amount, row) => amount.add(row.amount),
              new Prisma.Decimal(0),
            ),
          )
          .add(
            document.advanceApplications.reduce(
              (amount, row) => amount.add(row.amount),
              new Prisma.Decimal(0),
            ),
          ),
      new Prisma.Decimal(0),
    );
}
export type ProjectHistoryParams = {
  tasksPage?: string;
  documentsPage?: string;
  boqsPage?: string;
  commercialPage?: string;
  auditsPage?: string;
  pageSize?: string;
};
export function projectHistoryInput(raw: ProjectHistoryParams = {}) {
  const pageSize = projectPageInput({ pageSize: raw.pageSize }).pageSize,
    page = (value?: string) =>
      projectPageInput({ page: value, pageSize: String(pageSize) }).page;
  return {
    pageSize,
    tasksPage: page(raw.tasksPage),
    documentsPage: page(raw.documentsPage),
    boqsPage: page(raw.boqsPage),
    commercialPage: page(raw.commercialPage),
    auditsPage: page(raw.auditsPage),
  };
}
export async function getProjectForActor(
  actor: ProjectActor,
  id: string,
  raw: ProjectHistoryParams = {},
) {
  const ids = await authorizedProjectBranchIds(actor);
  const paging = projectHistoryInput(raw),
    skip = (page: number) => (page - 1) * paging.pageSize;
  const project = await db.project.findFirst({
    where: { id, ...projectRecordScope(actor, ids) },
    include: {
      customer: true,
      branch: true,
      projectManager: true,
      members: { include: { user: true } },
      budgetLines: { orderBy: { position: "asc" } },
      milestones: { orderBy: { position: "asc" } },
      tasks: {
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: skip(paging.tasksPage),
        take: paging.pageSize,
      },
      documents: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: skip(paging.documentsPage),
        take: paging.pageSize,
      },
      quotationDocuments: {
        where: { documentType: "BOQ" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: skip(paging.boqsPage),
        take: paging.pageSize,
      },
      commercialDocuments: {
        orderBy: [{ issueDate: "desc" }, { id: "desc" }],
        skip: skip(paging.commercialPage),
        take: paging.pageSize,
      },
      audits: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: skip(paging.auditsPage),
        take: paging.pageSize,
      },
      _count: {
        select: {
          tasks: true,
          documents: true,
          quotationDocuments: { where: { documentType: "BOQ" } },
          commercialDocuments: true,
          audits: true,
        },
      },
    },
  });
  if (!project) throw new AuthorizationError();
  const paymentWhere = (type: "SALES_INVOICE" | "PURCHASE_BILL") => ({
      companyId: actor.companyId,
      document: {
        projectId: project.id,
        companyId: actor.companyId,
        branchId: project.branchId,
        type,
      },
    }),
    [
      openTasks,
      customerAllocations,
      customerAdvances,
      vendorAllocations,
      vendorAdvances,
    ] = await Promise.all([
      db.projectTask.count({
        where: {
          companyId: actor.companyId,
          projectId: project.id,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      }),
      db.settlementAllocation.aggregate({
        where: paymentWhere("SALES_INVOICE"),
        _sum: { amount: true },
      }),
      db.advanceApplication.aggregate({
        where: paymentWhere("SALES_INVOICE"),
        _sum: { amount: true },
      }),
      db.settlementAllocation.aggregate({
        where: paymentWhere("PURCHASE_BILL"),
        _sum: { amount: true },
      }),
      db.advanceApplication.aggregate({
        where: paymentWhere("PURCHASE_BILL"),
        _sum: { amount: true },
      }),
    ]);
  const budgetTotal = project.budgetLines.reduce(
      (sum, line) => sum.add(line.amount),
      new Prisma.Decimal(0),
    ),
    total = (
      a: { _sum: { amount: Prisma.Decimal | null } },
      b: { _sum: { amount: Prisma.Decimal | null } },
    ) => new Prisma.Decimal(a._sum.amount ?? 0).add(b._sum.amount ?? 0),
    pages = {
      tasks: Math.max(1, Math.ceil(project._count.tasks / paging.pageSize)),
      documents: Math.max(
        1,
        Math.ceil(project._count.documents / paging.pageSize),
      ),
      boqs: Math.max(
        1,
        Math.ceil(project._count.quotationDocuments / paging.pageSize),
      ),
      commercial: Math.max(
        1,
        Math.ceil(project._count.commercialDocuments / paging.pageSize),
      ),
      audits: Math.max(1, Math.ceil(project._count.audits / paging.pageSize)),
    };
  return {
    ...project,
    budgetTotal,
    openTasks,
    customerPayments: total(customerAllocations, customerAdvances),
    vendorPayments: total(vendorAllocations, vendorAdvances),
    history: { ...paging, pages },
  };
}
export async function getProjectFormOptionsForActor(
  actor: ProjectActor,
  projectId?: string,
) {
  await requireAccountModules(actor, "PROJECTS");
  const ids = await authorizedProjectBranchIds(actor);
  const project = projectId
    ? await db.project.findFirst({
        where: { id: projectId, ...projectRecordScope(actor, ids) },
        select: { id: true, branchId: true, customerId: true },
      })
    : null;
  if (projectId && !project) throw new AuthorizationError();
  const branches = await db.branch.findMany({
    where: { companyId: actor.companyId, isActive: true, id: { in: ids } },
    select: { id: true, name: true },
  });
  const managers = await db.user.findMany({
    where: {
      companyId: actor.companyId,
      isActive: true,
      accountAccessActive: true,
      accountRole: { in: ["ACCOUNT_ADMIN", "PROJECT_MANAGER"] },
      ...(project
        ? {
            OR: [
              { branchAccessScope: "ALL_BRANCHES" },
              { branchAccesses: { some: { branchId: project.branchId } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      accountRole: true,
      branchAccessScope: true,
      branchAccesses: { select: { branchId: true } },
    },
    orderBy: { name: "asc" },
  });
  const memberCandidates = project ? managers : [];
  const boqCandidates = project
    ? await db.quotationDocument.findMany({
        where: {
          companyId: actor.companyId,
          documentType: "BOQ",
          customerId: project.customerId,
          branchId: project.branchId,
          OR: [{ projectId: null }, { projectId: project.id }],
        },
        select: { id: true, documentNumber: true, status: true },
        orderBy: { documentNumber: "asc" },
      })
    : [];
  return { branches, managers, memberCandidates, boqCandidates };
}
export async function replaceBudget(raw: unknown) {
  const data = budgetInput.parse(raw),
    actor = await projectActor(true),
    ids = await authorizedProjectBranchIds(actor);
  return db.$transaction(
    async (tx) => {
      await mutable(tx, actor, data.projectId, ids);
      await tx.projectBudgetLine.deleteMany({
        where: { companyId: actor.companyId, projectId: data.projectId },
      });
      if (data.lines.length)
        await tx.projectBudgetLine.createMany({
          data: data.lines.map((line, position) => ({
            ...line,
            amount: new Prisma.Decimal(line.amount),
            position,
            companyId: actor.companyId,
            projectId: data.projectId,
          })),
        });
      await audit(tx, actor, data.projectId, "PROJECT_BUDGET_CHANGED", {
        total: data.lines
          .reduce((sum, line) => sum.add(line.amount), new Prisma.Decimal(0))
          .toString(),
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function addMilestone(raw: unknown) {
  const data = milestoneInput.parse(raw),
    actor = await projectActor(true),
    ids = await authorizedProjectBranchIds(actor);
  return db.$transaction(
    async (tx) => {
      await mutable(tx, actor, data.projectId, ids);
      const last = await tx.projectMilestone.findFirst({
        where: { companyId: actor.companyId, projectId: data.projectId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const milestone = await tx.projectMilestone.create({
        data: {
          ...data,
          companyId: actor.companyId,
          createdById: actor.id,
          position: (last?.position ?? -1) + 1,
          completedAt: nextCompletionAt(data.status, null),
        },
      });
      await audit(tx, actor, data.projectId, "MILESTONE_CHANGED", {
        action: "CREATED",
        milestoneId: milestone.id,
      });
      return milestone;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function updateMilestone(raw: unknown) {
  const data = milestoneUpdateInput.parse(raw),
    actor = await projectActor(true),
    ids = await authorizedProjectBranchIds(actor);
  return db.$transaction(
    async (tx) => {
      await mutable(tx, actor, data.projectId, ids);
      const current = await tx.projectMilestone.findFirst({
        where: {
          id: data.milestoneId,
          companyId: actor.companyId,
          projectId: data.projectId,
        },
      });
      if (!current) throw new AuthorizationError();
      await tx.projectMilestone.update({
        where: { id: current.id },
        data: {
          title: data.title,
          description: data.description,
          startDate: data.startDate,
          dueDate: data.dueDate,
          status: data.status,
          completedAt: nextCompletionAt(data.status, current.completedAt),
        },
      });
      await audit(tx, actor, data.projectId, "MILESTONE_CHANGED", {
        action: "UPDATED",
        milestoneId: current.id,
        from: current.status,
        to: data.status,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function addTask(raw: unknown) {
  const data = taskInput.parse(raw),
    actor = await projectActor(true),
    ids = await authorizedProjectBranchIds(actor);
  return db.$transaction(
    async (tx) => {
      await mutable(tx, actor, data.projectId, ids);
      await validateTaskRelations(
        tx,
        actor,
        data.projectId,
        data.milestoneId,
        data.assigneeUserId,
      );
      const task = await tx.projectTask.create({
        data: {
          ...data,
          companyId: actor.companyId,
          createdById: actor.id,
          completedAt: nextCompletionAt(data.status, null),
        },
      });
      await audit(tx, actor, data.projectId, "TASK_CHANGED", {
        action: "CREATED",
        taskId: task.id,
      });
      return task;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function updateTask(raw: unknown) {
  const data = taskUpdateInput.parse(raw),
    actor = await projectActor(true),
    ids = await authorizedProjectBranchIds(actor);
  return db.$transaction(
    async (tx) => {
      await mutable(tx, actor, data.projectId, ids);
      const current = await tx.projectTask.findFirst({
        where: {
          id: data.taskId,
          companyId: actor.companyId,
          projectId: data.projectId,
        },
      });
      if (!current) throw new AuthorizationError();
      await validateTaskRelations(
        tx,
        actor,
        data.projectId,
        data.milestoneId,
        data.assigneeUserId,
      );
      await tx.projectTask.update({
        where: { id: current.id },
        data: {
          title: data.title,
          description: data.description,
          milestoneId: data.milestoneId ?? null,
          assigneeUserId: data.assigneeUserId ?? null,
          dueDate: data.dueDate,
          priority: data.priority,
          status: data.status,
          completedAt: nextCompletionAt(data.status, current.completedAt),
        },
      });
      await audit(tx, actor, data.projectId, "TASK_CHANGED", {
        action: "UPDATED",
        taskId: current.id,
        from: current.status,
        to: data.status,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function addProjectMember(
  projectId: string,
  userId: string,
  role = "MEMBER",
) {
  const actor = await projectActor(true),
    ids = await authorizedProjectBranchIds(actor);
  return db.$transaction(
    async (tx) => {
      const project = await mutable(tx, actor, projectId, ids);
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          companyId: actor.companyId,
          isActive: true,
          accountAccessActive: true,
          accountRole: { in: ["ACCOUNT_ADMIN", "PROJECT_MANAGER"] },
          OR: [
            { branchAccessScope: "ALL_BRANCHES" },
            { branchAccesses: { some: { branchId: project.branchId } } },
          ],
        },
      });
      if (!user) throw new Error("INVALID_PROJECT_MEMBER");
      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId, userId } },
        create: { companyId: actor.companyId, projectId, userId, role },
        update: { role },
      });
      await audit(tx, actor, projectId, "PROJECT_TEAM_CHANGED");
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function linkBoq(projectId: string, boqId: string) {
  const actor = await projectActor(true),
    ids = await authorizedProjectBranchIds(actor);
  return db.$transaction(async (tx) => {
    const project = await mutable(tx, actor, projectId, ids);
    const boq = await tx.quotationDocument.findFirst({
      where: {
        id: boqId,
        companyId: actor.companyId,
        documentType: "BOQ",
        customerId: project.customerId,
        branchId: project.branchId,
        OR: [{ projectId: null }, { projectId: project.id }],
      },
    });
    if (!boq) throw new Error("INVALID_BOQ");
    await tx.quotationDocument.updateMany({
      where: { id: boq.id, companyId: actor.companyId, projectId: null },
      data: { projectId: project.id },
    });
    await audit(tx, actor, project.id, "BOQ_LINKED");
  });
}
export async function closeProjectForActor(
  actor: ProjectActor,
  projectId: string,
  raw: { handoverDate?: Date; handoverNote?: string; closureNote?: string },
) {
  const ids = await authorizedProjectBranchIds(actor);
  return db.$transaction(
    async (tx) => {
      const project = await mutable(tx, actor, projectId, ids),
        now = new Date();
      await tx.project.updateMany({
        where: {
          id: project.id,
          companyId: actor.companyId,
          status: project.status,
        },
        data: {
          status: "CLOSED",
          actualEndDate: now,
          handoverDate: raw.handoverDate,
          handoverNote: raw.handoverNote,
          closureNote: raw.closureNote,
          closedById: actor.id,
          closedAt: now,
        },
      });
      await audit(tx, actor, project.id, "PROJECT_CLOSED");
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function reopenProjectForActor(
  actor: ProjectActor,
  projectId: string,
) {
  if (actor.accountRole !== "ACCOUNT_ADMIN") throw new AuthorizationError();
  const ids = await authorizedProjectBranchIds(actor);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "projects" WHERE "id"=${projectId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
      const project = await tx.project.findFirst({
        where: {
          id: projectId,
          status: "CLOSED",
          ...projectRecordScope(actor, ids),
        },
      });
      if (!project) throw new AuthorizationError();
      await tx.project.update({
        where: { id: project.id },
        data: { status: "ACTIVE", closedById: null, closedAt: null },
      });
      await audit(tx, actor, project.id, "PROJECT_REOPENED");
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
const allowedMime = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
export async function addProjectDocument(
  projectId: string,
  file: File,
  category = "GENERAL",
  notes?: string,
) {
  const actor = await projectActor(true),
    ids = await authorizedProjectBranchIds(actor);
  if (!file.size || file.size > 10 * 1024 * 1024 || !allowedMime.has(file.type))
    throw new Error("INVALID_PROJECT_DOCUMENT");
  const id = randomUUID(),
    key = `companies/${actor.companyId}/projects/${projectId}/${id}`;
  await db.$transaction((tx) => mutable(tx, actor, projectId, ids));
  await privateStorage().put(key, Buffer.from(await file.arrayBuffer()));
  try {
    return await db.$transaction(async (tx) => {
      await mutable(tx, actor, projectId, ids);
      const document = await tx.projectDocument.create({
        data: {
          id,
          companyId: actor.companyId,
          projectId,
          uploadedById: actor.id,
          category,
          displayName: file.name.slice(0, 240),
          storageKey: key,
          mimeType: file.type,
          sizeBytes: file.size,
          notes,
        },
      });
      await audit(tx, actor, projectId, "DOCUMENT_ADDED");
      return document;
    });
  } catch (error) {
    await privateStorage()
      .delete(key)
      .catch(() => undefined);
    throw error;
  }
}
export async function downloadProjectDocument(id: string) {
  const actor = await projectActor(false),
    ids = await authorizedProjectBranchIds(actor);
  await requireAccountModules(actor, "PROJECTS");
  const document = await db.projectDocument.findFirst({
    where: {
      id,
      companyId: actor.companyId,
      project: projectRecordScope(actor, ids),
    },
  });
  if (!document) throw new AuthorizationError();
  return {
    data: await privateStorage().get(document.storageKey),
    mimeType: document.mimeType,
    name: document.displayName,
  };
}

export async function createProject(raw: unknown) {
  return createProjectForActor(await projectActor(true), raw);
}
export async function updateProject(raw: unknown) {
  return updateProjectForActor(await projectActor(true), raw);
}
export async function listProjects(
  raw: { page?: string; pageSize?: string } = {},
) {
  return listProjectsForActor(await projectActor(false), raw);
}
export async function getProject(id: string, raw: ProjectHistoryParams = {}) {
  return getProjectForActor(await projectActor(false), id, raw);
}
export async function getProjectFormOptions(projectId?: string) {
  return getProjectFormOptionsForActor(await projectActor(false), projectId);
}

export async function closeProject(
  projectId: string,
  raw: { handoverDate?: Date; handoverNote?: string; closureNote?: string },
) {
  return closeProjectForActor(await projectActor(true), projectId, raw);
}
export async function reopenProject(projectId: string) {
  return reopenProjectForActor(await projectActor(true), projectId);
}
