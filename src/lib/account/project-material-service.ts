import { createHash } from "node:crypto";
import { retrySerializable } from "./transaction-retry";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import {
  authorizedProjectBranchIds,
  projectRecordScope,
  requireProjectFunction,
  authorizeProjectForCommercial,
  type ProjectActor,
} from "./projects";
import { reverseJournalInTx, postJournalInTx } from "@/lib/accounting/service";
import { signedQuantity, stockValuation } from "./inventory";
import { requireAccountModules } from "./modules";
const D = Prisma.Decimal,
  decimal = z
    .union([z.string(), z.number().finite()])
    .transform(String)
    .pipe(z.string().regex(/^\d{1,14}(\.\d{1,6})?$/))
    .refine((value) => new D(value).gt(0), "Quantity must be positive");
type MaterialRequest = Record<string, unknown>;
export function materialRequestHash(kind: string, request: MaterialRequest) {
  const fields = Object.fromEntries(
    Object.entries(request)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [
        key,
        value instanceof Date
          ? value.toISOString().slice(0, 10)
          : key === "quantity"
            ? new D(String(value)).toString()
            : value,
      ]),
  );
  return createHash("sha256")
    .update(JSON.stringify({ kind, fields }))
    .digest("hex");
}
async function validateMaterialReplay(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  existing: Prisma.ProjectMaterialMovementGetPayload<Record<string, never>>,
  kind: string,
  d: MaterialRequest,
  hash: string,
) {
  const ids = await authorizedProjectBranchIds(actor);
  for (const id of [existing.projectId, existing.destinationProjectId].filter(
    (value): value is string => !!value,
  ))
    if (
      !(await tx.project.findFirst({
        where: { id, ...projectRecordScope(actor, ids) },
        select: { id: true },
      }))
    )
      throw new Error("Not authorized");
  if (existing.movementType !== kind) throw new Error("IDEMPOTENCY_KEY_REUSED");
  if (existing.requestHash) {
    if (existing.requestHash !== hash)
      throw new Error("IDEMPOTENCY_KEY_REUSED");
    return existing;
  }
  const projectId = d.projectId ?? d.sourceProjectId;
  const fields = [
    "warehouseId",
    "productId",
    "destinationProjectId",
    "sourceMovementId",
    "projectBudgetLineId",
    "batchId",
    "serialNumberId",
    "reason",
    "notes",
    "attachmentKey",
  ] as const;
  if (projectId && existing.projectId !== projectId)
    throw new Error("IDEMPOTENCY_KEY_REUSED");
  if (d.movementId && existing.reversalOfId !== d.movementId)
    throw new Error("IDEMPOTENCY_KEY_REUSED");
  if (d.quantity !== undefined && !existing.quantity.eq(String(d.quantity)))
    throw new Error("IDEMPOTENCY_KEY_REUSED");
  if (
    existing.movementDate.toISOString().slice(0, 10) !==
    (d.movementDate as Date).toISOString().slice(0, 10)
  )
    throw new Error("IDEMPOTENCY_KEY_REUSED");
  for (const field of fields)
    if (d[field] !== undefined && (existing[field] ?? "") !== (d[field] ?? ""))
      throw new Error("IDEMPOTENCY_KEY_REUSED");
  return existing;
}
async function recordMaterialAudit(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  movement: Prisma.ProjectMaterialMovementGetPayload<Record<string, never>>,
  journalId?: string,
) {
  await tx.projectAuditEvent.create({
    data: {
      companyId: actor.companyId,
      projectId: movement.projectId,
      actorUserId: actor.id,
      eventType:
        movement.movementType === "REVERSAL"
          ? "PROJECT_MATERIAL_REVERSED"
          : "PROJECT_MATERIAL_POSTED",
      metadata: {
        movementId: movement.id,
        movementType: movement.movementType,
        quantity: movement.quantity.toString(),
        totalCost: movement.totalCost.toString(),
        ...(journalId ? { journalId } : {}),
      },
    },
  });
}
export const inventoryIssueInput = z
  .object({
    projectId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    productId: z.string().uuid(),
    batchId: z.string().uuid().optional(),
    serialNumberId: z.string().uuid().optional(),
    quantity: decimal,
    projectBudgetLineId: z.string().uuid(),
    movementDate: z.coerce.date(),
    notes: z.string().max(5000).optional(),
    attachmentKey: z.string().max(500).optional(),
    idempotencyKey: z.string().min(8).max(160),
  })
  .strict();
async function postMaterialJournalInTx(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  input: {
    lines: Array<{
      ledgerAccountId: string;
      debit: string;
      credit: string;
      description?: string;
    }>;
  } & Record<string, unknown>,
) {
  // Free materials still have quantity/history. A zero-value movement must not
  // manufacture a nonzero journal to satisfy the accounting balance check.
  if (
    input.lines.every(
      (line) => new D(line.debit).isZero() && new D(line.credit).isZero(),
    )
  )
    return null;
  return postJournalInTx(tx, actor, input);
}
async function postingContext(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  branchId: string,
  date: Date,
  keys: string[],
) {
  const [fy, locked, accounts] = await Promise.all([
    tx.financialYear.findFirst({
      where: {
        companyId: actor.companyId,
        isActive: true,
        status: "OPEN",
        startDate: { lte: date },
        endDate: { gte: date },
      },
    }),
    tx.accountingPeriodLock.findFirst({
      where: {
        companyId: actor.companyId,
        financialYear: { startDate: { lte: date }, endDate: { gte: date } },
        lockedThrough: { gte: date },
      },
    }),
    tx.ledgerAccount.findMany({
      where: {
        companyId: actor.companyId,
        systemKey: { in: keys },
        isActive: true,
        allowPosting: true,
      },
    }),
  ]);
  if (!fy) throw new Error("INVALID_FINANCIAL_YEAR");
  if (locked) throw new Error("PERIOD_LOCKED");
  const map = new Map(accounts.map((x) => [x.systemKey!, x.id]));
  for (const key of keys)
    if (!map.has(key)) throw new Error(`SYSTEM_LEDGER_MISSING:${key}`);
  return { fy, account: (key: string) => map.get(key)!, branchId };
}
export async function issueInventoryToProjectForActor(
  actor: ProjectActor,
  raw: unknown,
) {
  await requireProjectFunction(actor, "ACCOUNT_PROJECT_COST_EDIT");
  await requireAccountModules(actor, "INVENTORY");
  const d = inventoryIssueInput.parse(raw);
  const requestHash = materialRequestHash("INVENTORY_ISSUE_TO_PROJECT", d);
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        const existing = await tx.projectMaterialMovement.findUnique({
          where: {
            companyId_idempotencyKey: {
              companyId: actor.companyId!,
              idempotencyKey: d.idempotencyKey,
            },
          },
        });
        if (existing)
          return validateMaterialReplay(
            tx,
            actor,
            existing,
            "INVENTORY_ISSUE_TO_PROJECT",
            d,
            requestHash,
          );
        const projectRecord = await tx.project.findFirst({
          where: { id: d.projectId, companyId: actor.companyId },
        });
        if (!projectRecord) throw new Error("INVALID_PROJECT");
        const project = await authorizeProjectForCommercial(
            actor,
            d.projectId,
            projectRecord.branchId,
            undefined,
            tx,
          ),
          [warehouse, product, budget] = await Promise.all([
            tx.warehouse.findFirst({
              where: {
                id: d.warehouseId,
                companyId: actor.companyId,
                branchId: project.branchId,
                isActive: true,
              },
            }),
            tx.accountProduct.findFirst({
              where: {
                id: d.productId,
                companyId: actor.companyId,
                isActive: true,
                trackInventory: true,
              },
            }),
            tx.projectBudgetLine.findFirst({
              where: {
                id: d.projectBudgetLineId,
                companyId: actor.companyId,
                projectId: project.id,
              },
            }),
          ]);
        if (!warehouse || !product || !budget)
          throw new Error("INVALID_PROJECT_MATERIAL_CONTEXT");
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.companyId}:${warehouse.id}:${product.id}`}))`;
        const prior = await tx.stockMovement.findMany({
          where: {
            companyId: actor.companyId,
            warehouseId: warehouse.id,
            productId: product.id,
            ...(d.batchId ? { batchId: d.batchId } : {}),
            ...(d.serialNumberId ? { serialNumberId: d.serialNumberId } : {}),
          },
          orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }],
        });
        const valuation = stockValuation(prior),
          quantity = new D(d.quantity);
        const settings = await tx.accountSettings.findUnique({
          where: { companyId: actor.companyId },
        });
        if (!settings?.negativeStockAllowed && valuation.quantity.lt(quantity))
          throw new Error("INSUFFICIENT_STOCK");
        if (
          d.batchId &&
          !(await tx.inventoryBatch.findFirst({
            where: {
              id: d.batchId,
              companyId: actor.companyId,
              productId: product.id,
            },
          }))
        )
          throw new Error("INVALID_INVENTORY_BATCH");
        if (d.serialNumberId) {
          if (
            !quantity.eq(1) ||
            !(await tx.inventorySerialNumber.findFirst({
              where: {
                id: d.serialNumberId,
                companyId: actor.companyId,
                productId: product.id,
              },
            })) ||
            !prior
              .reduce(
                (n, x) => n.add(signedQuantity(x.movementType, x.quantity)),
                new D(0),
              )
              .eq(1)
          )
            throw new Error("SERIAL_NOT_AVAILABLE");
        }
        const unitCost = valuation.quantity.gt(0)
            ? valuation.averageUnitCost
            : valuation.quantity.lt(0)
              ? Prisma.Decimal.max(
                  0,
                  valuation.stockValue.div(valuation.quantity),
                ).toDecimalPlaces(4)
              : (prior.at(-1)?.unitCost ?? product.costPrice ?? new D(0)),
          total = quantity.mul(unitCost).toDecimalPlaces(2),
          ctx = await postingContext(
            tx,
            actor,
            project.branchId,
            d.movementDate,
            ["INVENTORY_ASSET", "PROJECT_MATERIAL_WIP"],
          ),
          movement = await tx.projectMaterialMovement.create({
            data: {
              companyId: actor.companyId!,
              branchId: project.branchId,
              projectId: project.id,
              movementType: "INVENTORY_ISSUE_TO_PROJECT",
              productId: product.id,
              warehouseId: warehouse.id,
              batchId: d.batchId,
              serialNumberId: d.serialNumberId,
              quantity,
              originalUnitCost: unitCost,
              totalCost: total,
              movementDate: d.movementDate,
              projectBudgetLineId: budget.id,
              notes: d.notes,
              attachmentKey: d.attachmentKey,
              createdById: actor.id,
              idempotencyKey: d.idempotencyKey,
              requestHash,
            },
          });
        await tx.stockMovement.create({
          data: {
            companyId: actor.companyId!,
            branchId: project.branchId,
            warehouseId: warehouse.id,
            productId: product.id,
            movementType: "TRANSFER_OUT",
            quantity,
            unitCost,
            totalCost: total,
            sourceType: "PROJECT_MATERIAL_ISSUE",
            sourceId: movement.id,
            batchId: d.batchId,
            serialNumberId: d.serialNumberId,
            movementDate: d.movementDate,
            createdById: actor.id,
          },
        });
        await postMaterialJournalInTx(tx, actor, {
          financialYearId: ctx.fy.id,
          branchId: project.branchId,
          entryDate: d.movementDate,
          sourceType: "PROJECT_MATERIAL_ISSUE",
          sourceId: movement.id,
          postingPurpose: "PRIMARY",
          lines: [
            {
              ledgerAccountId: ctx.account("PROJECT_MATERIAL_WIP"),
              debit: total.toString(),
              credit: "0",
              description: product.name,
            },
            {
              ledgerAccountId: ctx.account("INVENTORY_ASSET"),
              debit: "0",
              credit: total.toString(),
              description: product.name,
            },
          ],
        });
        await recordMaterialAudit(tx, actor, movement);
        return movement;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
export async function issueInventoryToProject(raw: unknown) {
  return issueInventoryToProjectForActor(
    (await requirePermissionForMutation(
      "ACCOUNT_PROJECT_COST_EDIT",
    )) as ProjectActor,
    raw,
  );
}
export const consumeMaterialInput = z
  .object({
    projectId: z.string().uuid(),
    sourceMovementId: z.string().uuid(),
    quantity: decimal,
    movementDate: z.coerce.date(),
    projectBudgetLineId: z.string().uuid().optional(),
    notes: z.string().max(5000).optional(),
    attachmentKey: z.string().max(500).optional(),
    idempotencyKey: z.string().min(8).max(160),
  })
  .strict();
async function scopedBudgetLineId(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  projectId: string,
  requested?: string | null,
  inherited?: string | null,
) {
  const id = requested ?? inherited;
  if (!id) return null;
  const line = await tx.projectBudgetLine.findFirst({
    where: { id, companyId: actor.companyId, projectId },
    select: { id: true },
  });
  if (requested && !line) throw new Error("INVALID_PROJECT_BUDGET_LINE");
  // Old transfer records may carry the source project's budget. Keep their
  // history intact, but never reuse that foreign budget for new postings.
  return line?.id ?? null;
}
async function authorizedLineage(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  projectId: string,
  sourceMovementId: string,
) {
  const source = await tx.projectMaterialMovement.findFirst({
    where: {
      id: sourceMovementId,
      companyId: actor.companyId,
      movementType: {
        in: [
          "DIRECT_PROJECT_RECEIPT",
          "INVENTORY_ISSUE_TO_PROJECT",
          "TRANSFER_IN",
        ],
      },
    },
  });
  if (!source || source.projectId !== projectId)
    throw new Error("INVALID_MATERIAL_LINEAGE");
  const projectRecord = await tx.project.findFirst({
    where: { id: projectId, companyId: actor.companyId },
  });
  if (!projectRecord) throw new Error("INVALID_PROJECT");
  await authorizeProjectForCommercial(
    actor,
    projectId,
    projectRecord.branchId,
    undefined,
    tx,
  );
  const rows = await tx.projectMaterialMovement.findMany({
    where: {
      companyId: actor.companyId,
      projectId,
      OR: [
        { id: source.id },
        { sourceMovementId: source.id },
        { reversalOfId: source.id },
      ],
    },
  });
  return { source, project: projectRecord, rows };
}
export async function consumeProjectMaterialForActor(
  actor: ProjectActor,
  raw: unknown,
) {
  await requireProjectFunction(actor, "ACCOUNT_PROJECT_MATERIAL_CONSUME");
  const d = consumeMaterialInput.parse(raw);
  const requestHash = materialRequestHash("CONSUMPTION", d);
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        const existing = await tx.projectMaterialMovement.findUnique({
          where: {
            companyId_idempotencyKey: {
              companyId: actor.companyId!,
              idempotencyKey: d.idempotencyKey,
            },
          },
        });
        if (existing)
          return validateMaterialReplay(
            tx,
            actor,
            existing,
            "CONSUMPTION",
            d,
            requestHash,
          );
        const { source, project, rows } = await authorizedLineage(
          tx,
          actor,
          d.projectId,
          d.sourceMovementId,
        );
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.companyId}:${source.id}:${project.id}`}))`;
        const quantity = new D(d.quantity);
        const { assertMaterialAvailability } =
          await import("./project-material");
        assertMaterialAvailability(rows, quantity);
        const total = quantity.mul(source.originalUnitCost).toDecimalPlaces(2),
          ctx = await postingContext(
            tx,
            actor,
            project.branchId,
            d.movementDate,
            ["PROJECT_MATERIAL_WIP", "PROJECT_MATERIAL_COST"],
          ),
          movement = await tx.projectMaterialMovement.create({
            data: {
              companyId: actor.companyId!,
              branchId: project.branchId,
              projectId: project.id,
              movementType: "CONSUMPTION",
              purchaseDocumentId: source.purchaseDocumentId,
              purchaseLineId: source.purchaseLineId,
              purchaseAllocationId: source.purchaseAllocationId,
              productId: source.productId,
              warehouseId: source.warehouseId,
              batchId: source.batchId,
              serialNumberId: source.serialNumberId,
              quantity,
              originalUnitCost: source.originalUnitCost,
              totalCost: total,
              movementDate: d.movementDate,
              projectBudgetLineId: await scopedBudgetLineId(
                tx,
                actor,
                project.id,
                d.projectBudgetLineId,
                source.projectBudgetLineId,
              ),
              notes: d.notes,
              attachmentKey: d.attachmentKey,
              createdById: actor.id,
              sourceMovementId: source.id,
              idempotencyKey: d.idempotencyKey,
              requestHash,
            },
          });
        await postMaterialJournalInTx(tx, actor, {
          financialYearId: ctx.fy.id,
          branchId: project.branchId,
          entryDate: d.movementDate,
          sourceType: "PROJECT_MATERIAL_CONSUMPTION",
          sourceId: movement.id,
          postingPurpose: "PRIMARY",
          lines: [
            {
              ledgerAccountId: ctx.account("PROJECT_MATERIAL_COST"),
              debit: total.toString(),
              credit: "0",
              description: "Project material consumed",
            },
            {
              ledgerAccountId: ctx.account("PROJECT_MATERIAL_WIP"),
              debit: "0",
              credit: total.toString(),
              description: "Project material consumed",
            },
          ],
        });
        await recordMaterialAudit(tx, actor, movement);
        return movement;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
export async function consumeProjectMaterial(raw: unknown) {
  return consumeProjectMaterialForActor(
    (await requirePermissionForMutation(
      "ACCOUNT_PROJECT_MATERIAL_CONSUME",
    )) as ProjectActor,
    raw,
  );
}
export const returnMaterialInput = z
  .object({
    projectId: z.string().uuid(),
    sourceMovementId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    quantity: decimal,
    movementDate: z.coerce.date(),
    reason: z.string().trim().min(1).max(1000),
    notes: z.string().max(5000).optional(),
    attachmentKey: z.string().max(500).optional(),
    idempotencyKey: z.string().min(8).max(160),
  })
  .strict();
export async function returnProjectMaterialForActor(
  actor: ProjectActor,
  raw: unknown,
) {
  await requireProjectFunction(actor, "ACCOUNT_PROJECT_MATERIAL_RETURN");
  const d = returnMaterialInput.parse(raw);
  const requestHash = materialRequestHash("RETURN_TO_INVENTORY", d);
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        const existing = await tx.projectMaterialMovement.findUnique({
          where: {
            companyId_idempotencyKey: {
              companyId: actor.companyId!,
              idempotencyKey: d.idempotencyKey,
            },
          },
        });
        if (existing)
          return validateMaterialReplay(
            tx,
            actor,
            existing,
            "RETURN_TO_INVENTORY",
            d,
            requestHash,
          );
        const { source, project, rows } = await authorizedLineage(
          tx,
          actor,
          d.projectId,
          d.sourceMovementId,
        );
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.companyId}:${source.id}:${project.id}`}))`;
        const warehouse = await tx.warehouse.findFirst({
          where: {
            id: d.warehouseId,
            companyId: actor.companyId,
            branchId: project.branchId,
            isActive: true,
          },
        });
        if (!warehouse) throw new Error("INVALID_DESTINATION_WAREHOUSE");
        const quantity = new D(d.quantity),
          { assertMaterialAvailability } = await import("./project-material");
        assertMaterialAvailability(rows, quantity);
        const total = quantity.mul(source.originalUnitCost).toDecimalPlaces(2),
          ctx = await postingContext(
            tx,
            actor,
            project.branchId,
            d.movementDate,
            ["PROJECT_MATERIAL_WIP", "INVENTORY_ASSET"],
          ),
          movement = await tx.projectMaterialMovement.create({
            data: {
              companyId: actor.companyId!,
              branchId: project.branchId,
              projectId: project.id,
              movementType: "RETURN_TO_INVENTORY",
              purchaseDocumentId: source.purchaseDocumentId,
              purchaseLineId: source.purchaseLineId,
              purchaseAllocationId: source.purchaseAllocationId,
              productId: source.productId,
              warehouseId: warehouse.id,
              batchId: source.batchId,
              serialNumberId: source.serialNumberId,
              quantity,
              originalUnitCost: source.originalUnitCost,
              totalCost: total,
              movementDate: d.movementDate,
              projectBudgetLineId: await scopedBudgetLineId(
                tx,
                actor,
                source.projectId,
                undefined,
                source.projectBudgetLineId,
              ),
              reason: d.reason,
              notes: d.notes,
              attachmentKey: d.attachmentKey,
              createdById: actor.id,
              sourceMovementId: source.id,
              idempotencyKey: d.idempotencyKey,
              requestHash,
            },
          });
        await tx.stockMovement.create({
          data: {
            companyId: actor.companyId!,
            branchId: project.branchId,
            warehouseId: warehouse.id,
            productId: source.productId,
            movementType: "TRANSFER_IN",
            quantity,
            unitCost: source.originalUnitCost,
            totalCost: total,
            sourceType: "PROJECT_MATERIAL_RETURN",
            sourceId: movement.id,
            batchId: source.batchId,
            serialNumberId: source.serialNumberId,
            movementDate: d.movementDate,
            createdById: actor.id,
          },
        });
        await postMaterialJournalInTx(tx, actor, {
          financialYearId: ctx.fy.id,
          branchId: project.branchId,
          entryDate: d.movementDate,
          sourceType: "PROJECT_MATERIAL_RETURN",
          sourceId: movement.id,
          postingPurpose: "PRIMARY",
          lines: [
            {
              ledgerAccountId: ctx.account("INVENTORY_ASSET"),
              debit: total.toString(),
              credit: "0",
              description: d.reason,
            },
            {
              ledgerAccountId: ctx.account("PROJECT_MATERIAL_WIP"),
              debit: "0",
              credit: total.toString(),
              description: d.reason,
            },
          ],
        });
        await recordMaterialAudit(tx, actor, movement);
        return movement;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
export async function returnProjectMaterial(raw: unknown) {
  return returnProjectMaterialForActor(
    (await requirePermissionForMutation(
      "ACCOUNT_PROJECT_MATERIAL_RETURN",
    )) as ProjectActor,
    raw,
  );
}
export const transferProjectMaterialInput = z
  .object({
    sourceProjectId: z.string().uuid(),
    destinationProjectId: z.string().uuid(),
    destinationBudgetLineId: z.string().uuid().optional(),
    sourceMovementId: z.string().uuid(),
    quantity: decimal,
    movementDate: z.coerce.date(),
    reason: z.string().trim().min(1).max(1000),
    notes: z.string().max(5000).optional(),
    attachmentKey: z.string().max(500).optional(),
    idempotencyKey: z.string().min(8).max(150),
  })
  .strict()
  .refine((v) => v.sourceProjectId !== v.destinationProjectId, {
    message: "PROJECTS_MUST_DIFFER",
    path: ["destinationProjectId"],
  });
export async function transferProjectMaterialForActor(
  actor: ProjectActor,
  raw: unknown,
) {
  await requireProjectFunction(actor, "ACCOUNT_PROJECT_MATERIAL_TRANSFER");
  const d = transferProjectMaterialInput.parse(raw);
  const requestHash = materialRequestHash("TRANSFER_OUT", d);
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        const existing = await tx.projectMaterialMovement.findUnique({
          where: {
            companyId_idempotencyKey: {
              companyId: actor.companyId!,
              idempotencyKey: d.idempotencyKey,
            },
          },
        });
        if (existing)
          return validateMaterialReplay(
            tx,
            actor,
            existing,
            "TRANSFER_OUT",
            d,
            requestHash,
          );
        const { source, project, rows } = await authorizedLineage(
            tx,
            actor,
            d.sourceProjectId,
            d.sourceMovementId,
          ),
          destinationRecord = await tx.project.findFirst({
            where: { id: d.destinationProjectId, companyId: actor.companyId },
          });
        if (!destinationRecord) throw new Error("INVALID_DESTINATION_PROJECT");
        const destination = await authorizeProjectForCommercial(
          actor,
          d.destinationProjectId,
          destinationRecord.branchId,
          undefined,
          tx,
        );
        if (destination.branchId !== project.branchId)
          throw new Error("CROSS_BRANCH_PROJECT_TRANSFER_NOT_ALLOWED");
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.companyId}:${source.id}:${project.id}`}))`;
        const quantity = new D(d.quantity),
          { assertMaterialAvailability } = await import("./project-material");
        assertMaterialAvailability(rows, quantity);
        const total = quantity.mul(source.originalUnitCost).toDecimalPlaces(2),
          ctx = await postingContext(
            tx,
            actor,
            project.branchId,
            d.movementDate,
            ["PROJECT_MATERIAL_WIP"],
          ),
          out = await tx.projectMaterialMovement.create({
            data: {
              companyId: actor.companyId!,
              branchId: project.branchId,
              projectId: project.id,
              movementType: "TRANSFER_OUT",
              purchaseDocumentId: source.purchaseDocumentId,
              purchaseLineId: source.purchaseLineId,
              purchaseAllocationId: source.purchaseAllocationId,
              productId: source.productId,
              warehouseId: source.warehouseId,
              batchId: source.batchId,
              serialNumberId: source.serialNumberId,
              quantity,
              originalUnitCost: source.originalUnitCost,
              totalCost: total,
              movementDate: d.movementDate,
              sourceProjectId: project.id,
              destinationProjectId: destination.id,
              projectBudgetLineId: await scopedBudgetLineId(
                tx,
                actor,
                source.projectId,
                undefined,
                source.projectBudgetLineId,
              ),
              reason: d.reason,
              notes: d.notes,
              attachmentKey: d.attachmentKey,
              createdById: actor.id,
              sourceMovementId: source.id,
              idempotencyKey: d.idempotencyKey,
              requestHash,
            },
          });
        const destinationBudgetLineId = await scopedBudgetLineId(
          tx,
          actor,
          destination.id,
          d.destinationBudgetLineId,
        );
        const incoming = await tx.projectMaterialMovement.create({
          data: {
            companyId: actor.companyId!,
            branchId: destination.branchId,
            projectId: destination.id,
            movementType: "TRANSFER_IN",
            purchaseDocumentId: source.purchaseDocumentId,
            purchaseLineId: source.purchaseLineId,
            purchaseAllocationId: source.purchaseAllocationId,
            productId: source.productId,
            warehouseId: source.warehouseId,
            batchId: source.batchId,
            serialNumberId: source.serialNumberId,
            quantity,
            originalUnitCost: source.originalUnitCost,
            totalCost: total,
            movementDate: d.movementDate,
            sourceProjectId: project.id,
            destinationProjectId: destination.id,
            projectBudgetLineId: destinationBudgetLineId,
            reason: d.reason,
            notes: d.notes,
            attachmentKey: d.attachmentKey,
            createdById: actor.id,
            sourceMovementId: source.id,
            idempotencyKey: `${d.idempotencyKey}:in`,
            requestHash,
          },
        });
        if (!source.warehouseId) throw new Error("SOURCE_WAREHOUSE_MISSING");
        await tx.stockMovement.createMany({
          data: [
            {
              companyId: actor.companyId!,
              branchId: project.branchId,
              warehouseId: source.warehouseId,
              productId: source.productId,
              movementType: "TRANSFER_IN",
              quantity,
              unitCost: source.originalUnitCost,
              totalCost: total,
              sourceType: "PROJECT_TRANSFER_RETURN",
              sourceId: out.id,
              batchId: source.batchId,
              serialNumberId: source.serialNumberId,
              movementDate: d.movementDate,
              createdById: actor.id,
            },
            {
              companyId: actor.companyId!,
              branchId: project.branchId,
              warehouseId: source.warehouseId,
              productId: source.productId,
              movementType: "TRANSFER_OUT",
              quantity,
              unitCost: source.originalUnitCost,
              totalCost: total,
              sourceType: "PROJECT_TRANSFER_ISSUE",
              sourceId: incoming.id,
              batchId: source.batchId,
              serialNumberId: source.serialNumberId,
              movementDate: d.movementDate,
              createdById: actor.id,
            },
          ],
        });
        await postMaterialJournalInTx(tx, actor, {
          financialYearId: ctx.fy.id,
          branchId: project.branchId,
          entryDate: d.movementDate,
          sourceType: "PROJECT_MATERIAL_TRANSFER",
          sourceId: out.id,
          postingPurpose: "PRIMARY",
          lines: [
            {
              ledgerAccountId: ctx.account("PROJECT_MATERIAL_WIP"),
              debit: total.toString(),
              credit: "0",
              description: `Transfer to ${destination.name}`,
            },
            {
              ledgerAccountId: ctx.account("PROJECT_MATERIAL_WIP"),
              debit: "0",
              credit: total.toString(),
              description: `Transfer from ${project.name}`,
            },
          ],
        });
        await recordMaterialAudit(tx, actor, out);
        await recordMaterialAudit(tx, actor, incoming);
        return out;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
export async function transferProjectMaterial(raw: unknown) {
  return transferProjectMaterialForActor(
    (await requirePermissionForMutation(
      "ACCOUNT_PROJECT_MATERIAL_TRANSFER",
    )) as ProjectActor,
    raw,
  );
}
export const reverseProjectMaterialInput = z
  .object({
    movementId: z.string().uuid(),
    movementDate: z.coerce.date(),
    reason: z.string().trim().min(1).max(1000),
    idempotencyKey: z.string().min(8).max(160),
  })
  .strict();
export async function reverseProjectMaterialForActor(
  actor: ProjectActor,
  raw: unknown,
) {
  await requireProjectFunction(actor, "ACCOUNT_PROJECT_MATERIAL_TRANSFER");
  const d = reverseProjectMaterialInput.parse(raw);
  const requestHash = materialRequestHash("REVERSAL", d);
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        const existing = await tx.projectMaterialMovement.findUnique({
          where: {
            companyId_idempotencyKey: {
              companyId: actor.companyId!,
              idempotencyKey: d.idempotencyKey,
            },
          },
        });
        if (existing)
          return validateMaterialReplay(
            tx,
            actor,
            existing,
            "REVERSAL",
            d,
            requestHash,
          );
        const source = await tx.projectMaterialMovement.findFirst({
          where: {
            id: d.movementId,
            companyId: actor.companyId,
            movementType: { not: "REVERSAL" },
          },
        });
        if (!source) throw new Error("INVALID_SOURCE_MOVEMENT");
        if (
          await tx.projectMaterialMovement.findUnique({
            where: { reversalOfId: source.id },
          })
        )
          throw new Error("MOVEMENT_ALREADY_REVERSED");
        const projectRecord = await tx.project.findFirst({
          where: { id: source.projectId, companyId: actor.companyId },
        });
        if (!projectRecord) throw new Error("INVALID_PROJECT");
        await authorizeProjectForCommercial(
          actor,
          source.projectId,
          projectRecord.branchId,
          undefined,
          tx,
        );
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.companyId}:${source.id}:reverse`}))`;
        if (source.movementType === "TRANSFER_IN")
          throw new Error("REVERSE_TRANSFER_FROM_SOURCE_PROJECT");
        if (source.movementType === "DIRECT_PROJECT_RECEIPT")
          throw new Error("REVERSE_PROJECT_PURCHASE_DOCUMENT");
        if (source.movementType === "INVENTORY_ISSUE_TO_PROJECT") {
          const rows = await tx.projectMaterialMovement.findMany({
            where: {
              companyId: actor.companyId,
              projectId: source.projectId,
              OR: [
                { id: source.id },
                { sourceMovementId: source.id },
                { reversalOfId: source.id },
              ],
            },
          });
          const { assertMaterialAvailability } =
            await import("./project-material");
          assertMaterialAvailability(rows, source.quantity);
        }
        let transferPair: typeof source | null = null;
        if (source.movementType === "TRANSFER_OUT") {
          transferPair = await tx.projectMaterialMovement.findUnique({
            where: {
              companyId_idempotencyKey: {
                companyId: actor.companyId,
                idempotencyKey: `${source.idempotencyKey}:in`,
              },
            },
          });
          if (
            !transferPair ||
            transferPair.movementType !== "TRANSFER_IN" ||
            !transferPair.quantity.eq(source.quantity) ||
            !transferPair.totalCost.eq(source.totalCost)
          )
            throw new Error("TRANSFER_PAIR_INVALID");
          await authorizeProjectForCommercial(
            actor,
            transferPair.projectId,
            transferPair.branchId,
            undefined,
            tx,
          );
          const rows = await tx.projectMaterialMovement.findMany({
            where: {
              companyId: actor.companyId,
              projectId: transferPair.projectId,
              OR: [
                { id: transferPair.id },
                { sourceMovementId: transferPair.id },
                { reversalOfId: transferPair.id },
              ],
            },
          });
          const { assertMaterialAvailability } =
            await import("./project-material");
          assertMaterialAvailability(rows, source.quantity);
        }
        if (
          source.movementType === "RETURN_TO_INVENTORY" &&
          source.warehouseId
        ) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.companyId}:${source.warehouseId}:${source.productId}`}))`;
          const settings = await tx.accountSettings.findUnique({
            where: { companyId: actor.companyId },
          });
          if (!settings?.negativeStockAllowed) {
            const rows = await tx.stockMovement.findMany({
              where: {
                companyId: actor.companyId,
                warehouseId: source.warehouseId,
                productId: source.productId,
                ...(source.batchId ? { batchId: source.batchId } : {}),
                ...(source.serialNumberId
                  ? { serialNumberId: source.serialNumberId }
                  : {}),
              },
            });
            if (
              rows
                .reduce(
                  (n, r) => n.add(signedQuantity(r.movementType, r.quantity)),
                  new D(0),
                )
                .lt(source.quantity)
            )
              throw new Error("INSUFFICIENT_STOCK");
          }
        }
        const reversal = await tx.projectMaterialMovement.create({
          data: {
            companyId: actor.companyId!,
            branchId: source.branchId,
            projectId: source.projectId,
            movementType: "REVERSAL",
            purchaseDocumentId: source.purchaseDocumentId,
            purchaseLineId: source.purchaseLineId,
            purchaseAllocationId: source.purchaseAllocationId,
            productId: source.productId,
            warehouseId: source.warehouseId,
            projectLocation: source.projectLocation,
            batchId: source.batchId,
            serialNumberId: source.serialNumberId,
            quantity: source.quantity,
            originalUnitCost: source.originalUnitCost,
            totalCost: source.totalCost,
            movementDate: d.movementDate,
            sourceProjectId: source.sourceProjectId,
            destinationProjectId: source.destinationProjectId,
            projectBudgetLineId: await scopedBudgetLineId(
              tx,
              actor,
              source.projectId,
              undefined,
              source.projectBudgetLineId,
            ),
            reason: d.reason,
            createdById: actor.id,
            sourceMovementId: source.sourceMovementId,
            reversalOfId: source.id,
            idempotencyKey: d.idempotencyKey,
            requestHash,
          },
        });
        let incomingReversal: typeof reversal | null = null;
        if (transferPair) {
          const {
            id: ignoredId,
            createdAt: ignoredAt,
            reversalOfId: ignoredReversal,
            requestHash: ignoredHash,
            idempotencyKey: ignoredKey,
            ...pairFields
          } = transferPair;
          void ignoredId;
          void ignoredAt;
          void ignoredReversal;
          void ignoredHash;
          void ignoredKey;
          incomingReversal = await tx.projectMaterialMovement.create({
            data: {
              ...pairFields,
              projectBudgetLineId: await scopedBudgetLineId(
                tx,
                actor,
                transferPair.projectId,
                undefined,
                transferPair.projectBudgetLineId,
              ),
              movementType: "REVERSAL",
              reversalOfId: transferPair.id,
              movementDate: d.movementDate,
              reason: d.reason,
              createdById: actor.id,
              idempotencyKey: `${d.idempotencyKey}:in`,
              requestHash,
            },
          });
        }
        if (
          source.movementType === "INVENTORY_ISSUE_TO_PROJECT" ||
          source.movementType === "RETURN_TO_INVENTORY"
        ) {
          if (!source.warehouseId) throw new Error("SOURCE_WAREHOUSE_MISSING");
          await tx.stockMovement.create({
            data: {
              companyId: actor.companyId!,
              branchId: source.branchId,
              warehouseId: source.warehouseId,
              productId: source.productId,
              movementType:
                source.movementType === "INVENTORY_ISSUE_TO_PROJECT"
                  ? "TRANSFER_IN"
                  : "TRANSFER_OUT",
              quantity: source.quantity,
              unitCost: source.originalUnitCost,
              totalCost: source.totalCost,
              sourceType: "PROJECT_MATERIAL_REVERSAL",
              sourceId: reversal.id,
              batchId: source.batchId,
              serialNumberId: source.serialNumberId,
              movementDate: d.movementDate,
              createdById: actor.id,
            },
          });
        }
        const sourceJournal = await tx.journalEntry.findFirst({
          where: {
            companyId: actor.companyId,
            sourceId: source.id,
            status: "POSTED",
          },
          include: { lines: true },
        });
        // Automatic issues on a Project purchase share the supplier bill's
        // journal. Reverse only the material allocation, not that entire bill.
        const purchaseIssue = source.movementType === "INVENTORY_ISSUE_TO_PROJECT" &&
          !!source.purchaseAllocationId && !!source.purchaseDocumentId;
        if (!sourceJournal && !source.totalCost.isZero() && !purchaseIssue)
          throw new Error("SOURCE_JOURNAL_MISSING");
        let journalReversal = sourceJournal
          ? await reverseJournalInTx(tx, actor, {
              journalEntryId: sourceJournal.id,
              entryDate: d.movementDate,
              reason: d.reason,
            })
          : null;
        if (!sourceJournal && purchaseIssue && !source.totalCost.isZero()) {
          const allocation = await tx.purchaseLineAllocation.findFirst({
            where: { id: source.purchaseAllocationId!, companyId: actor.companyId,
              projectId: source.projectId, documentLineId: source.purchaseLineId! },
            include: { documentLine: { include: { document: true } } },
          });
          if (!allocation || allocation.documentLine.document.id !== source.purchaseDocumentId ||
              allocation.documentLine.document.status !== "POSTED")
            throw new Error("INVALID_SOURCE_MOVEMENT");
          const ctx = await postingContext(tx, actor, source.branchId, d.movementDate,
            ["INVENTORY_ASSET", "PROJECT_MATERIAL_WIP"]);
          journalReversal = await postMaterialJournalInTx(tx, actor, {
            financialYearId: ctx.fy.id, branchId: source.branchId,
            entryDate: d.movementDate, sourceType: "PROJECT_MATERIAL_REVERSAL",
            sourceId: reversal.id, postingPurpose: "PRIMARY",
            lines: [
              { ledgerAccountId: ctx.account("INVENTORY_ASSET"), debit: source.totalCost.toString(), credit: "0", description: d.reason },
              { ledgerAccountId: ctx.account("PROJECT_MATERIAL_WIP"), debit: "0", credit: source.totalCost.toString(), description: d.reason },
            ],
          });
        }
        await recordMaterialAudit(tx, actor, reversal, journalReversal?.id);
        if (incomingReversal)
          await recordMaterialAudit(
            tx,
            actor,
            incomingReversal,
            journalReversal?.id,
          );
        return reversal;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
export async function reverseProjectMaterial(raw: unknown) {
  return reverseProjectMaterialForActor(
    (await requirePermissionForMutation(
      "ACCOUNT_PROJECT_MATERIAL_TRANSFER",
    )) as ProjectActor,
    raw,
  );
}
export async function projectMaterialContextForActor(
  actor: ProjectActor,
  input: { projectId?: string; sourcePage?: number; historyPage?: number } = {},
) {
  await requireProjectFunction(actor, "ACCOUNT_PROJECT_MATERIAL_VIEW");
  const ids = await authorizedProjectBranchIds(actor),
    scope = projectRecordScope(actor, ids),
    paging = z
      .object({
        projectId: z.string().uuid().optional(),
        sourcePage: z.number().int().min(1).max(100000).default(1),
        historyPage: z.number().int().min(1).max(100000).default(1),
      })
      .parse(input),
    scopedProjects = await db.project.findMany({
      where: {
        ...scope,
        ...(paging.projectId ? { id: paging.projectId } : {}),
      },
      select: { id: true },
    }),
    projectIds = scopedProjects.map((row) => row.id),
    where = { companyId: actor.companyId, projectId: { in: projectIds } },
    sourceWhere = {
      ...where,
      movementType: {
        in: [
          "DIRECT_PROJECT_RECEIPT",
          "INVENTORY_ISSUE_TO_PROJECT",
          "TRANSFER_IN",
        ] as import("@prisma/client").ProjectMaterialMovementType[],
      },
    };
  const projectBranches =
    actor.branchAccessScope === "SELECTED_BRANCHES"
      ? { branchId: { in: ids } }
      : {};
  const [projects, warehouses, products, budgetLines, movements] =
    await Promise.all([
      db.project.findMany({
        where: {
          companyId: actor.companyId,
          status: { notIn: ["CLOSED", "CANCELLED"] },
          ...scope,
        },
        select: { id: true, name: true, projectNumber: true, branchId: true },
        orderBy: { projectNumber: "asc" },
      }),
      db.warehouse.findMany({
        where: {
          companyId: actor.companyId,
          isActive: true,
          ...projectBranches,
        },
        select: { id: true, name: true, branchId: true },
      }),
      db.accountProduct.findMany({
        where: {
          companyId: actor.companyId,
          isActive: true,
          trackInventory: true,
        },
        select: { id: true, name: true, code: true },
      }),
      db.projectBudgetLine.findMany({
        where: {
          companyId: actor.companyId,
          project: {
            ...scope,
            status: { notIn: ["CLOSED", "CANCELLED"] },
          },
        },
        select: { id: true, projectId: true, title: true, category: true },
        orderBy: { position: "asc" },
      }),
      db.projectMaterialMovement.findMany({
        where,
        orderBy: [
          { movementDate: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        skip: (paging.historyPage - 1) * 50,
        take: 50,
      }),
    ]);
  const [sources, sourceCount, historyCount, company] = await Promise.all([
    db.projectMaterialMovement.findMany({
      where: sourceWhere,
      orderBy: [
        { movementDate: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: (paging.sourcePage - 1) * 50,
      take: 50,
    }),
    db.projectMaterialMovement.count({ where: sourceWhere }),
    db.projectMaterialMovement.count({ where }),
    db.company.findUniqueOrThrow({
      where: { id: actor.companyId },
      select: { productEdition: true },
    }),
  ]);
  const availability = sources.length
    ? await db.$queryRaw<
        Array<{
          id: string;
          availableQuantity: Prisma.Decimal;
          isReversed: boolean;
        }>
      >`
    SELECT root."id",
      CASE WHEN EXISTS (SELECT 1 FROM "project_material_movements" r WHERE r."companyId"=root."companyId" AND r."reversalOfId"=root."id") THEN 0::numeric
      ELSE root."quantity" - COALESCE((
        SELECT SUM(child."quantity") FROM "project_material_movements" child
        WHERE child."companyId"=root."companyId" AND child."projectId"=root."projectId" AND child."sourceMovementId"=root."id"
          AND child."movementType" IN ('CONSUMPTION','RETURN_TO_INVENTORY','TRANSFER_OUT')
          AND NOT EXISTS (SELECT 1 FROM "project_material_movements" r WHERE r."companyId"=child."companyId" AND r."reversalOfId"=child."id")
      ),0) END AS "availableQuantity",
      EXISTS (SELECT 1 FROM "project_material_movements" r WHERE r."companyId"=root."companyId" AND r."reversalOfId"=root."id") AS "isReversed"
    FROM "project_material_movements" root WHERE root."companyId"=${actor.companyId}::uuid AND root."id" IN (${Prisma.join(sources.map((row) => Prisma.sql`${row.id}::uuid`))})
  `
    : [];
  const byId = new Map(availability.map((row) => [row.id, row]));
  const reversed = new Set(
    (
      await db.projectMaterialMovement.findMany({
        where: {
          companyId: actor.companyId,
          reversalOfId: { in: movements.map((row) => row.id) },
        },
        select: { reversalOfId: true },
      })
    ).map((row) => row.reversalOfId),
  );
  return {
    projects,
    warehouses,
    products,
    budgetLines,
    movements: movements.map((row) => ({
      ...row,
      isReversed: reversed.has(row.id),
    })),
    sources: sources.map((row) => ({
      ...row,
      availableQuantity: byId.get(row.id)?.availableQuantity ?? new D(0),
      isReversed: byId.get(row.id)?.isReversed ?? false,
      productName:
        products.find((product) => product.id === row.productId)?.name ??
        "Historical item",
    })),
    sourcePage: paging.sourcePage,
    sourcePages: Math.max(1, Math.ceil(sourceCount / 50)),
    historyPage: paging.historyPage,
    historyPages: Math.max(1, Math.ceil(historyCount / 50)),
    capabilities: {
      ISSUE: canUsePermission(
        actor,
        company.productEdition,
        "ACCOUNT_PROJECT_COST_EDIT",
      ),
      CONSUME: canUsePermission(
        actor,
        company.productEdition,
        "ACCOUNT_PROJECT_MATERIAL_CONSUME",
      ),
      RETURN: canUsePermission(
        actor,
        company.productEdition,
        "ACCOUNT_PROJECT_MATERIAL_RETURN",
      ),
      TRANSFER: canUsePermission(
        actor,
        company.productEdition,
        "ACCOUNT_PROJECT_MATERIAL_TRANSFER",
      ),
      REVERSE: canUsePermission(
        actor,
        company.productEdition,
        "ACCOUNT_PROJECT_MATERIAL_TRANSFER",
      ),
    },
  };
}
