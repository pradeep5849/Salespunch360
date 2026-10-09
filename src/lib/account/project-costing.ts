import { Prisma, ProjectChangeOrderStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { requireAccountModules } from "./modules";
import {
  requireProjectFunction,
  authorizedProjectBranchIds,
  projectRecordScope,
  type ProjectActor,
} from "./projects";
import { allocateDocumentNumberInTx } from "./numbering";
import { projectMaterialCostBreakdown } from "./project-material";
import { documentOutstandingsBatch } from "./commercial";
const D = Prisma.Decimal,
  Z = new D(0),
  sum = (xs: Prisma.Decimal[]) => xs.reduce((a, b) => a.add(b), Z);
export type CostDocument = {
  id?: string;
  type: string;
  status: string;
  taxableTotal: Prisma.Decimal;
  sourcePurchaseOrderId?: string | null;
};
// Purchase-linked issues are already included in allocated purchase cost.
// Keep the full movement set for availability, consumption and transfer reporting.
export function inventoryIssueCostNotPurchased(rows: Array<{
  id: string; movementType: string; reversalOfId: string | null;
  purchaseAllocationId: string | null; totalCost: Prisma.Decimal;
}>) {
  const reversed = new Set(rows.filter(x => x.movementType === "REVERSAL").map(x => x.reversalOfId));
  return sum(rows.filter(x => x.movementType === "INVENTORY_ISSUE_TO_PROJECT" && !x.purchaseAllocationId && !reversed.has(x.id)).map(x => x.totalCost));
}
export function projectCosting(input: {
  originalValue: Prisma.Decimal;
  contractRevenueBase?: Prisma.Decimal;
  estimatedCost: Prisma.Decimal;
  budget: Prisma.Decimal;
  documents: CostDocument[];
  allocatedPurchaseCost?: Prisma.Decimal;
  committedAllocatedCost?: Prisma.Decimal;
  materialAdjustments?: {
    inventoryIssued: Prisma.Decimal;
    transferIn: Prisma.Decimal;
    returned: Prisma.Decimal;
    transferOut: Prisma.Decimal;
    consumed: Prisma.Decimal;
    unused: Prisma.Decimal;
  };
  advanceReceived?: Prisma.Decimal;
  amountReceived?: Prisma.Decimal;
  accountingReceivable?: Prisma.Decimal;
  expenses?: Prisma.Decimal[];
  approvedChanges?: Array<{
    valueDelta: Prisma.Decimal;
    estimatedCostDelta: Prisma.Decimal;
  }>;
  closed?: boolean;
}) {
  const changes = input.approvedChanges ?? [],
    approvedChangeOrders = sum(changes.map((x) => x.valueDelta)),
    contractRevenueBase = (
      input.contractRevenueBase ?? input.originalValue
    ).add(approvedChangeOrders),
    estimated = input.estimatedCost.add(
      sum(changes.map((x) => x.estimatedCostDelta)),
    ),
    documentPurchases = sum(
      input.documents
        .filter((x) => x.status === "POSTED" && x.type === "PURCHASE_BILL")
        .map((x) => x.taxableTotal),
    ).sub(
      sum(
        input.documents
          .filter((x) => x.status === "POSTED" && x.type === "DEBIT_NOTE")
          .map((x) => x.taxableTotal),
      ),
    ),
    actualPurchases = input.allocatedPurchaseCost ?? documentPurchases,
    material = input.materialAdjustments,
    materialNet = material
      ? material.inventoryIssued
          .add(material.transferIn)
          .sub(material.returned)
          .sub(material.transferOut)
      : Z,
    actualCost = actualPurchases
      .add(materialNet)
      .add(sum(input.expenses ?? [])),
    billed = new Map<string, Prisma.Decimal>();
  for (const bill of input.documents.filter(
    (x) =>
      x.status === "POSTED" &&
      x.type === "PURCHASE_BILL" &&
      x.sourcePurchaseOrderId,
  ))
    billed.set(
      bill.sourcePurchaseOrderId!,
      (billed.get(bill.sourcePurchaseOrderId!) ?? Z).add(bill.taxableTotal),
    );
  const committed =
      input.committedAllocatedCost ??
      sum(
        input.documents
          .filter((x) => x.status === "POSTED" && x.type === "PURCHASE_ORDER")
          .map((po) =>
            Prisma.Decimal.max(
              Z,
              po.taxableTotal.sub(billed.get(po.id ?? "") ?? Z),
            ),
          ),
      ),
    revenue = sum(
      input.documents
        .filter((x) => x.status === "POSTED" && x.type === "SALES_INVOICE")
        .map((x) => x.taxableTotal),
    ).sub(
      sum(
        input.documents
          .filter((x) => x.status === "POSTED" && x.type === "CREDIT_NOTE")
          .map((x) => x.taxableTotal),
      ),
    ),
    remainingPlan = Prisma.Decimal.max(
      Z,
      estimated.sub(actualCost).sub(committed),
    ),
    forecastCost = actualCost.add(committed).add(remainingPlan),
    expectedProfit = contractRevenueBase.sub(estimated),
    forecastProfit = contractRevenueBase.sub(forecastCost),
    profit = revenue.sub(actualCost),
    margin = (value: Prisma.Decimal, base: Prisma.Decimal) =>
      base.isZero() ? Z : value.div(base).mul(100);
  return {
    originalValue: input.originalValue,
    approvedChangeOrders,
    contractRevenueBase,
    estimatedCost: estimated,
    actualCost,
    directProjectPurchases: actualPurchases,
    inventoryMaterialIssued: material?.inventoryIssued ?? Z,
    materialConsumed: material?.consumed ?? Z,
    materialUnused: material?.unused ?? Z,
    materialReturned: material?.returned ?? Z,
    materialTransferredIn: material?.transferIn ?? Z,
    materialTransferredOut: material?.transferOut ?? Z,
    committedCost: committed,
    remainingForecast: forecastCost.sub(actualCost),
    forecastCost,
    budgetVariance: input.budget.sub(actualCost),
    revenue,
    advanceReceived: input.advanceReceived ?? Z,
    amountReceived: input.amountReceived ?? Z,
    contractBalance: contractRevenueBase.sub(input.advanceReceived ?? Z),
    accountingReceivable: input.accountingReceivable ?? Z,
    profit,
    expectedProfit,
    forecastProfit,
    finalProfit: input.closed ? profit : null,
    expectedMarginPercent: margin(expectedProfit, contractRevenueBase),
    forecastMarginPercent: margin(forecastProfit, contractRevenueBase),
    actualMarginPercent: margin(profit, revenue),
  };
}
export function projectAdvancePosition(input: {
  contractValue: Prisma.Decimal;
  advanceReceived: Prisma.Decimal;
  advanceApplied: Prisma.Decimal;
  invoiced: Prisma.Decimal;
  cashReceipts?: Prisma.Decimal;
}) {
  if (
    input.advanceApplied.gt(input.advanceReceived) ||
    input.advanceApplied.gt(input.invoiced)
  )
    throw new Error("ADVANCE_APPLICATION_EXCEEDS_BALANCE");
  return {
    contractBalance: input.contractValue.sub(input.advanceReceived),
    accountingReceivable: input.invoiced
      .sub(input.advanceApplied)
      .sub(input.cashReceipts ?? Z),
    advanceLiability: input.advanceReceived.sub(input.advanceApplied),
    revenue: input.invoiced,
    amountReceived: input.advanceApplied.add(input.cashReceipts ?? Z),
  };
}
type Actor = ProjectActor;
async function costingActor(edit = false) {
  const actor = (
    edit
      ? await requirePermissionForMutation("ACCOUNT_PROJECT_COST_EDIT")
      : await requirePermission("ACCOUNT_PROJECT_COST_VIEW")
  ) as Actor;
  await requireAccountModules(actor, "PROJECTS", "PROJECT_COSTING");
  return actor;
}
async function scopedProject(actor: Actor, id: string) {
  const branches = await authorizedProjectBranchIds(actor),
    project = await db.project.findFirst({
      where: { id, ...projectRecordScope(actor, branches) },
      include: {
        budgetLines: true,
        commercialDocuments: {
          include: {
            lines: true,
            allocations: true,
            advanceApplications: true,
            adjustments: { where: { status: "POSTED" } },
          },
        },
        customer: true,
      },
    });
  if (!project) throw new AuthorizationError();
  return project;
}
export function packageProfitability(
  documents: Array<{
    type: string;
    status: string;
    lines: Array<{
      workPackageId: string | null;
      taxableAmount: Prisma.Decimal;
    }>;
  }>,
  estimate: Array<{
    workPackageId: string | null;
    taxableAmount: Prisma.Decimal;
    internalCostTotal: Prisma.Decimal;
  }>,
  names: Map<string, string>,
) {
  const keys = new Set<string | null>([
    null,
    ...estimate.map((x) => x.workPackageId),
    ...documents.flatMap((x) => x.lines.map((l) => l.workPackageId)),
  ]);
  return [...keys].map((id) => {
    const estimatedRevenue = sum(
        estimate
          .filter((x) => x.workPackageId === id)
          .map((x) => x.taxableAmount),
      ),
      estimatedCost = sum(
        estimate
          .filter((x) => x.workPackageId === id)
          .map((x) => x.internalCostTotal),
      ),
      actualRevenue = sum(
        documents
          .filter((x) => x.status === "POSTED" && x.type === "SALES_INVOICE")
          .flatMap((x) =>
            x.lines
              .filter((l) => l.workPackageId === id)
              .map((l) => l.taxableAmount),
          ),
      ).sub(
        sum(
          documents
            .filter((x) => x.status === "POSTED" && x.type === "CREDIT_NOTE")
            .flatMap((x) =>
              x.lines
                .filter((l) => l.workPackageId === id)
                .map((l) => l.taxableAmount),
            ),
        ),
      ),
      actualCost = sum(
        documents
          .filter((x) => x.status === "POSTED" && x.type === "PURCHASE_BILL")
          .flatMap((x) =>
            x.lines
              .filter((l) => l.workPackageId === id)
              .map((l) => l.taxableAmount),
          ),
      ).sub(
        sum(
          documents
            .filter((x) => x.status === "POSTED" && x.type === "DEBIT_NOTE")
            .flatMap((x) =>
              x.lines
                .filter((l) => l.workPackageId === id)
                .map((l) => l.taxableAmount),
            ),
        ),
      ),
      profit = actualRevenue.sub(actualCost);
    return {
      id,
      name: id ? (names.get(id) ?? "Unknown") : "Other / Unassigned",
      estimatedRevenue,
      estimatedCost,
      actualRevenue,
      actualCost,
      profit,
      marginPercent: actualRevenue.isZero()
        ? Z
        : profit.div(actualRevenue).mul(100),
    };
  });
}
type AllocatedCostRow = {
  documentLineId: string;
  taxableAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  quantity: Prisma.Decimal;
  documentLine: {
    taxableAmount: Prisma.Decimal;
    quantity: Prisma.Decimal;
    document: {
      id: string;
      type: string;
      status: string;
      sourcePurchaseOrderId: string | null;
      taxCreditTreatment: string;
    };
  };
};
export function projectAllocatedPurchaseMetrics(
  rows: AllocatedCostRow[],
  adjustments: Array<{
    sourceCommercialLineId: string | null;
    taxableAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    quantity: Prisma.Decimal;
  }>,
) {
  let actual = new D(0);
  const ordered = new Map<string, Prisma.Decimal>(),
    billed = new Map<string, Prisma.Decimal>();
  for (const row of rows) {
    const doc = row.documentLine.document;
    if (doc.status !== "POSTED") continue;
    const cost = row.taxableAmount.add(
      doc.taxCreditTreatment === "ELIGIBLE" ? 0 : row.taxAmount,
    );
    if (doc.type === "PURCHASE_ORDER")
      ordered.set(doc.id, (ordered.get(doc.id) ?? Z).add(cost));
    if (doc.type !== "PURCHASE_BILL") continue;
    actual = actual.add(cost);
    if (doc.sourcePurchaseOrderId)
      billed.set(
        doc.sourcePurchaseOrderId,
        (billed.get(doc.sourcePurchaseOrderId) ?? Z).add(cost),
      );
    for (const correction of adjustments.filter(
      (x) => x.sourceCommercialLineId === row.documentLineId,
    )) {
      const ratio = row.documentLine.taxableAmount.gt(0)
        ? row.taxableAmount.div(row.documentLine.taxableAmount)
        : row.quantity.div(row.documentLine.quantity);
      actual = actual.sub(
        correction.taxableAmount
          .add(doc.taxCreditTreatment === "ELIGIBLE" ? 0 : correction.taxAmount)
          .mul(ratio),
      );
    }
  }
  return {
    actual: actual.toDecimalPlaces(2),
    committed: sum(
      [...ordered].map(([id, amount]) =>
        Prisma.Decimal.max(Z, amount.sub(billed.get(id) ?? Z)),
      ),
    ).toDecimalPlaces(2),
  };
}
export async function loadProjectCostingForActor(
  actor: Actor,
  projectId: string,
) {
  await requireProjectFunction(actor, "ACCOUNT_PROJECT_COST_VIEW");
  await requireAccountModules(actor, "PROJECTS", "PROJECT_COSTING");
  const project = await scopedProject(actor, projectId),
    quotation = project.sourceQuotationId
      ? await db.quotationDocument.findFirst({
          where: {
            id: project.sourceQuotationId,
            companyId: actor.companyId,
            status: "ACCEPTED",
          },
          include: {
            revisions: {
              where: { status: "ACCEPTED" },
              orderBy: { revisionNumber: "desc" },
              take: 1,
              include: { lines: true },
            },
          },
        })
      : null,
    changes = await db.projectChangeOrder.findMany({
      where: { companyId: actor.companyId, projectId },
      orderBy: { createdAt: "desc" },
    }),
    expenses = await db.expenseTransaction.findMany({
      where: {
        companyId: actor.companyId,
        projectId,
        status: "POSTED",
        type: { in: ["PROJECT_EXPENSE", "REIMBURSEMENT"] },
      },
    }),
    purchaseAllocations = await db.purchaseLineAllocation.findMany({
      where: { companyId: actor.companyId, projectId },
      include: { documentLine: { include: { document: true } } },
    }),
    materialRows = await db.projectMaterialMovement.findMany({
      where: { companyId: actor.companyId, projectId },
    }),
    projectSettlements = await db.accountSettlement.findMany({
      where: { companyId: actor.companyId, projectId },
      include: { applications: true },
    }),
    material = projectMaterialCostBreakdown(materialRows),
    purchaseAdjustments = await db.commercialDocumentLine.findMany({
      where: {
        companyId: actor.companyId,
        sourceCommercialLineId: {
          in: purchaseAllocations.map((x) => x.documentLineId),
        },
        document: {
          companyId: actor.companyId,
          type: "DEBIT_NOTE",
          status: "POSTED",
        },
      },
      select: {
        sourceCommercialLineId: true,
        taxableAmount: true,
        taxAmount: true,
        quantity: true,
      },
    }),
    purchaseMetrics = projectAllocatedPurchaseMetrics(
      purchaseAllocations,
      purchaseAdjustments,
    ),
    // A reversed automatic issue leaves the purchase payable intact and puts
    // its material back into company inventory. Its allocation is no longer a
    // retained Project cost; PO fulfilment still uses all posted purchases.
    reversedMaterialIds = new Set(materialRows.filter(x => x.movementType === "REVERSAL").map(x => x.reversalOfId)),
    returnedPurchaseAllocationIds = new Set(materialRows.filter(x => x.movementType === "INVENTORY_ISSUE_TO_PROJECT" && reversedMaterialIds.has(x.id)).map(x => x.purchaseAllocationId)),
    allocatedPurchaseCost = projectAllocatedPurchaseMetrics(
      purchaseAllocations.filter(x => !returnedPurchaseAllocationIds.has(x.id)),
      purchaseAdjustments,
    ).actual,
    advanceReceived = sum(
      projectSettlements
        .filter((x) => x.type === "CUSTOMER_ADVANCE")
        .map((x) => x.amount),
    ),
    amountReceived = sum(
      project.commercialDocuments
        .filter((x) => x.type === "SALES_INVOICE" && x.status === "POSTED")
        .flatMap((x) => [
          ...x.allocations.map((a) => a.amount),
          ...x.advanceApplications.map((a) => a.amount),
        ]),
    ),
    invoiceOutstandings = await documentOutstandingsBatch(
      actor.companyId,
      project.commercialDocuments.filter(
        (x) => x.type === "SALES_INVOICE" && x.status === "POSTED",
      ),
    ),
    accountingReceivable = sum([...invoiceOutstandings.values()]),
    committedAllocatedCost = purchaseMetrics.committed,
    budget = sum(project.budgetLines.map((x) => x.amount)),
    estimate = quotation?.revisions[0]?.internalCostTotal ?? budget,
    metrics = projectCosting({
      originalValue: project.projectValue,
      contractRevenueBase:
        quotation?.revisions[0]?.taxableTotal ?? project.projectValue,
      estimatedCost: estimate,
      budget,
      documents: project.commercialDocuments,
      allocatedPurchaseCost,
      committedAllocatedCost,
      advanceReceived,
      amountReceived,
      accountingReceivable,
      materialAdjustments: {
        inventoryIssued: inventoryIssueCostNotPurchased(materialRows),
        transferIn: material.transferIn,
        returned: material.returned,
        transferOut: material.transferOut,
        consumed: material.consumed,
        unused: material.unused,
      },
      expenses: expenses.map((x) =>
        x.totalAmount.sub(
          x.taxCreditTreatment === "ELIGIBLE" ? x.taxAmount : 0,
        ),
      ),
      approvedChanges: changes.filter((x) => x.status === "APPROVED"),
      closed: project.status === "CLOSED",
    }),
    workIds = [
      ...new Set(
        [
          ...(quotation?.revisions[0]?.lines.map((x) => x.workPackageId) ?? []),
          ...project.commercialDocuments.flatMap((x) =>
            x.lines.map((l) => l.workPackageId),
          ),
        ].filter(Boolean),
      ),
    ] as string[],
    works = await db.workPackage.findMany({
      where: { companyId: actor.companyId, id: { in: workIds } },
    });
  return {
    project,
    changes,
    metrics,
    packages: packageProfitability(
      project.commercialDocuments,
      quotation?.revisions[0]?.lines ?? [],
      new Map(works.map((x) => [x.id, x.name])),
    ),
    estimateSource: quotation ? "ACCEPTED_QUOTATION" : "PROJECT_BUDGET",
  };
}
export async function loadProjectCosting(projectId: string) {
  return loadProjectCostingForActor(await costingActor(), projectId);
}
const changeInput = z
  .object({
    projectId: z.string().uuid(),
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(5000).optional(),
    valueDelta: z.string(),
    estimatedCostDelta: z.string(),
  })
  .strict();
export async function createChangeOrder(raw: unknown) {
  const actor = await costingActor(true),
    data = changeInput.parse(raw),
    project = await scopedProject(actor, data.projectId);
  return db.$transaction(
    async (tx) => {
      const changeOrderNumber = await allocateDocumentNumberInTx(tx, {
          companyId: actor.companyId,
          branchId: project.branchId,
          seriesKey: "PROJECT_CHANGE_ORDER",
          defaults: { prefix: "CO-", padding: 6 },
        }),
        row = await tx.projectChangeOrder.create({
          data: {
            companyId: actor.companyId,
            projectId: project.id,
            changeOrderNumber,
            title: data.title,
            description: data.description,
            valueDelta: new D(data.valueDelta),
            estimatedCostDelta: new D(data.estimatedCostDelta),
            createdById: actor.id,
          },
        });
      await tx.projectAuditEvent.create({
        data: {
          companyId: actor.companyId,
          projectId: project.id,
          actorUserId: actor.id,
          eventType: "CHANGE_ORDER_CREATED",
          metadata: { changeOrderId: row.id },
        },
      });
      return row;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function updateChangeOrder(raw: unknown) {
  const actor = await costingActor(true),
    data = changeInput.extend({ changeOrderId: z.string().uuid() }).parse(raw);
  await scopedProject(actor, data.projectId);
  const changed = await db.projectChangeOrder.updateMany({
    where: {
      id: data.changeOrderId,
      companyId: actor.companyId,
      projectId: data.projectId,
      status: "DRAFT",
    },
    data: {
      title: data.title,
      description: data.description,
      valueDelta: new D(data.valueDelta),
      estimatedCostDelta: new D(data.estimatedCostDelta),
    },
  });
  if (changed.count !== 1) throw new Error("CHANGE_ORDER_NOT_EDITABLE");
}
export async function transitionChangeOrder(
  projectId: string,
  changeOrderId: string,
  to: ProjectChangeOrderStatus,
) {
  const actor = await costingActor(true);
  await scopedProject(actor, projectId);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "project_change_orders" WHERE "id"=${changeOrderId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
      const row = await tx.projectChangeOrder.findFirst({
        where: { id: changeOrderId, companyId: actor.companyId, projectId },
      });
      if (!row) throw new AuthorizationError();
      const allowed: Record<
        ProjectChangeOrderStatus,
        ProjectChangeOrderStatus[]
      > = {
        DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
        PENDING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
        APPROVED: [],
        REJECTED: [],
        CANCELLED: [],
      };
      if (!allowed[row.status].includes(to))
        throw new Error("INVALID_CHANGE_ORDER_TRANSITION");
      if (["APPROVED", "REJECTED"].includes(to)) {
        if (actor.accountRole !== "ACCOUNT_ADMIN")
          throw new AuthorizationError();
        if (row.createdById === actor.id)
          throw new Error("CHANGE_ORDER_SELF_APPROVAL_FORBIDDEN");
      }
      const updated = await tx.projectChangeOrder.update({
        where: { id: row.id },
        data: {
          status: to,
          ...(to === "APPROVED"
            ? { approvedAt: new Date(), approvedById: actor.id }
            : {}),
        },
      });
      await tx.projectAuditEvent.create({
        data: {
          companyId: actor.companyId,
          projectId,
          actorUserId: actor.id,
          eventType: (
            {
              PENDING_APPROVAL: "CHANGE_ORDER_SUBMITTED",
              APPROVED: "CHANGE_ORDER_APPROVED",
              REJECTED: "CHANGE_ORDER_REJECTED",
              CANCELLED: "CHANGE_ORDER_CANCELLED",
            } as const
          )[to as "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED"],
          metadata: { changeOrderId },
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
