import { Prisma } from "@prisma/client";
import { authorizeProjectForCommercial, type ProjectActor } from "./projects";
import { assertMaterialAvailability } from "./project-material";

const D = Prisma.Decimal;
type Document = Prisma.CommercialDocumentGetPayload<{
  include: { lines: { include: { purchaseAllocations: true } } };
}>;

/** Distribute the physical quantity independently of a financial price adjustment.
 * The last allocation retains the rounding remainder, conserving company quantity.
 */
export function purchaseReturnQuantities(
  sourceQuantity: Prisma.Decimal,
  returnedQuantity: Prisma.Decimal,
  allocations: Array<{ id: string; quantity: Prisma.Decimal }>,
) {
  if (
    sourceQuantity.lte(0) ||
    returnedQuantity.lt(0) ||
    returnedQuantity.gt(sourceQuantity)
  )
    throw new Error("ADJUSTMENT_STOCK_EXCEEDS_SOURCE");
  const allocated = allocations.reduce(
    (n, row) => n.add(row.quantity),
    new D(0),
  );
  if (!allocated.eq(sourceQuantity))
    throw new Error("INVALID_PURCHASE_ALLOCATION");
  let remaining = returnedQuantity;
  return new Map(
    allocations.map((row, index) => {
      const quantity =
        index === allocations.length - 1
          ? remaining
          : returnedQuantity
              .mul(row.quantity)
              .div(sourceQuantity)
              .toDecimalPlaces(6);
      remaining = remaining.sub(quantity);
      if (quantity.lt(0) || quantity.gt(row.quantity))
        throw new Error("ADJUSTMENT_STOCK_EXCEEDS_SOURCE");
      return [row.id, quantity];
    }),
  );
}

/** A supplier return removes unused material from its Project, not from normal
 * stock a second time. The debit note owns the payable, tax and journal posting.
 * Fully reversed automatic issues are already back in normal inventory.
 */
export async function projectPurchaseReturnsInTx(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  doc: Document,
  source: Document,
) {
  let projectReturnCost = new D(0);
  const projectReturnQuantities = new Map<string, Prisma.Decimal>();
  for (const sourceLine of source.lines) {
    for (const allocation of sourceLine.purchaseAllocations) {
      if (allocation.projectId)
        await authorizeProjectForCommercial(
          actor,
          allocation.projectId,
          source.branchId,
          undefined,
          tx,
        );
    }
  }
  const pendingQuantities = new Map<string, Prisma.Decimal>();
  for (const line of doc.lines) {
    const sourceLine = source.lines.find(
      (row) => row.id === line.sourceCommercialLineId,
    );
    if (!sourceLine) throw new Error("INVALID_SOURCE_LINE");
    const previous = await tx.commercialDocumentLine.aggregate({
      where: {
        companyId: actor.companyId,
        sourceCommercialLineId: sourceLine.id,
        document: { type: "DEBIT_NOTE", status: "POSTED", id: { not: doc.id } },
      },
      _sum: { stockReturnQuantity: true },
    });
    const pending = (pendingQuantities.get(sourceLine.id) ?? new D(0)).add(
      line.stockReturnQuantity,
    );
    pendingQuantities.set(sourceLine.id, pending);
    if (
      pending
        .add(previous._sum.stockReturnQuantity ?? 0)
        .gt(sourceLine.quantity)
    )
      throw new Error("ADJUSTMENT_STOCK_EXCEEDS_SOURCE");
    if (line.stockReturnQuantity.lte(0)) continue;
    if (
      line.productId !== sourceLine.productId ||
      line.batchId !== sourceLine.batchId ||
      line.serialNumberId !== sourceLine.serialNumberId
    )
      throw new Error("INVALID_SOURCE_STOCK_IDENTITY");
    const allocations = sourceLine.purchaseAllocations;
    if (!allocations.length) continue; // Legacy ordinary purchases retain their established inventory path.
    const quantities = purchaseReturnQuantities(
      sourceLine.quantity,
      line.stockReturnQuantity,
      allocations,
    );
    for (const allocation of allocations) {
      const quantity = quantities.get(allocation.id)!;
      if (
        allocation.allocationType !== "PROJECT" ||
        !allocation.projectId ||
        quantity.lte(0)
      )
        continue;
      const original = await tx.projectMaterialMovement.findFirst({
        where: {
          companyId: actor.companyId,
          projectId: allocation.projectId,
          purchaseAllocationId: allocation.id,
          purchaseDocumentId: source.id,
          purchaseLineId: sourceLine.id,
          movementType: {
            in: ["DIRECT_PROJECT_RECEIPT", "INVENTORY_ISSUE_TO_PROJECT"],
          },
        },
      });
      if (!original)
        throw new Error("PROJECT_PURCHASE_MATERIAL_SOURCE_REQUIRED");
      if (
        await tx.projectMaterialMovement.findUnique({
          where: { reversalOfId: original.id },
        })
      )
        continue;
      const lineage = await tx.projectMaterialMovement.findMany({
        where: {
          companyId: actor.companyId,
          projectId: allocation.projectId,
          OR: [
            { id: original.id },
            { sourceMovementId: original.id },
            { reversalOfId: original.id },
            {
              reversalOfId: {
                in: (
                  await tx.projectMaterialMovement.findMany({
                    where: {
                      companyId: actor.companyId,
                      sourceMovementId: original.id,
                    },
                    select: { id: true },
                  })
                ).map((row) => row.id),
              },
            },
          ],
        },
      });
      assertMaterialAvailability(lineage, quantity);
      const totalCost = quantity
        .mul(original.originalUnitCost)
        .toDecimalPlaces(2);
      const movement = await tx.projectMaterialMovement.create({
        data: {
          companyId: actor.companyId,
          branchId: doc.branchId,
          projectId: allocation.projectId,
          movementType: "RETURN_TO_VENDOR",
          productId: original.productId,
          warehouseId: original.warehouseId,
          batchId: original.batchId,
          serialNumberId: original.serialNumberId,
          purchaseDocumentId: source.id,
          purchaseLineId: sourceLine.id,
          purchaseAllocationId: allocation.id,
          correctionDocumentId: doc.id,
          correctionLineId: line.id,
          sourceMovementId: original.id,
          projectBudgetLineId: original.projectBudgetLineId,
          quantity,
          originalUnitCost: original.originalUnitCost,
          totalCost,
          movementDate: doc.issueDate,
          createdById: actor.id,
          reason: doc.notes ?? `Supplier return ${doc.documentNumber}`,
          idempotencyKey: `debit:${doc.id}:${line.id}:${allocation.id}:project-return`,
        },
      });
      await tx.projectAuditEvent.create({
        data: {
          companyId: actor.companyId,
          projectId: allocation.projectId,
          actorUserId: actor.id,
          eventType: "PROJECT_MATERIAL_POSTED",
          metadata: {
            movementId: movement.id,
            movementType: movement.movementType,
            purchaseDocumentId: source.id,
            correctionDocumentId: doc.id,
            quantity: quantity.toString(),
            totalCost: totalCost.toString(),
          },
        },
      });
      projectReturnCost = projectReturnCost.add(totalCost);
      projectReturnQuantities.set(
        line.id,
        (projectReturnQuantities.get(line.id) ?? new D(0)).add(quantity),
      );
    }
  }
  return { projectReturnCost, projectReturnQuantities };
}
