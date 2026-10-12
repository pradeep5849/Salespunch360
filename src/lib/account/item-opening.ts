import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/authorization";
import type { ProjectActor } from "./projects";
const decimal = z.string().regex(/^\d{1,14}(\.\d{1,4})?$/);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid opening date");
export const itemCreationExtras = z.object({
  creationRequestKey: z.string().uuid().optional(),
  itemLocation: z.string().trim().max(240).optional(),
  openingStock: z
    .object({
      warehouseId: z.preprocess(
        (value) => (value === "" ? undefined : value),
        z.string().uuid().optional(),
      ),
      quantity: decimal,
      unitCost: decimal,
      movementDate: date,
    })
    .strict()
    .refine(
      (value) =>
        new Prisma.Decimal(value.quantity).isZero() ||
        Boolean(value.warehouseId),
      { message: "Select an opening warehouse", path: ["warehouseId"] },
    )
    .optional(),
});
export function itemCreationHash(
  data: unknown,
  customValues: Record<string, unknown>,
  extras: z.infer<typeof itemCreationExtras>,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        data,
        Object.entries(customValues).sort(([a], [b]) => a.localeCompare(b)),
        extras.itemLocation ?? "",
        extras.openingStock
          ? {
              ...extras.openingStock,
              quantity: new Prisma.Decimal(
                extras.openingStock.quantity,
              ).toString(),
              unitCost: new Prisma.Decimal(
                extras.openingStock.unitCost,
              ).toString(),
            }
          : null,
      ]),
    )
    .digest("hex");
}
export async function validateItemOpeningScopeInTx(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  extras: z.infer<typeof itemCreationExtras>,
) {
  if (
    !extras.openingStock ||
    new Prisma.Decimal(extras.openingStock.quantity).isZero()
  )
    return;
  if (!extras.openingStock.warehouseId)
    throw new Error("INVALID_OPENING_WAREHOUSE");
  const warehouse = await tx.warehouse.findFirst({
    where: {
      id: extras.openingStock.warehouseId,
      companyId: actor.companyId,
      isActive: true,
    },
    select: { id: true, branchId: true },
  });
  if (
    !warehouse ||
    (actor.branchAccessScope === "SELECTED_BRANCHES" &&
      !actor.branchIds?.includes(warehouse.branchId))
  )
    throw new AuthorizationError();
  if (
    !(await tx.branch.findFirst({
      where: {
        id: warehouse.branchId,
        companyId: actor.companyId,
        isActive: true,
      },
      select: { id: true },
    }))
  )
    throw new AuthorizationError();
  return warehouse;
}
export async function saveItemOpeningInTx(
  tx: Prisma.TransactionClient,
  actor: ProjectActor,
  product: { id: string; trackInventory: boolean; trackingMode: string },
  extras: z.infer<typeof itemCreationExtras>,
) {
  const opening = extras.openingStock;
  if (!opening) return;
  if (!extras.creationRequestKey)
    throw new Error("OPENING_REQUEST_KEY_REQUIRED");
  if (!product.trackInventory || product.trackingMode !== "NONE")
    throw new Error("INVALID_OPENING_PRODUCT");
  const quantity = new Prisma.Decimal(opening.quantity),
    unitCost = new Prisma.Decimal(opening.unitCost);
  if (quantity.isZero()) return;
  const warehouse = await validateItemOpeningScopeInTx(tx, actor, extras);
  if (!warehouse) throw new AuthorizationError();
  const totalCost = quantity.mul(unitCost).toDecimalPlaces(2);
  if (totalCost.gte("10000000000000000"))
    throw new Error("OPENING_VALUE_OUT_OF_RANGE");
  const row = await tx.stockMovement.create({
    data: {
      companyId: actor.companyId,
      branchId: warehouse.branchId,
      warehouseId: warehouse.id,
      productId: product.id,
      movementType: "OPENING",
      quantity,
      unitCost,
      totalCost,
      movementDate: new Date(opening.movementDate),
      sourceType: "ITEM_CREATION",
      sourceId: extras.creationRequestKey,
      sourceLineId: product.id,
      reason: "Item opening stock",
      createdById: actor.id,
    },
  });
  await tx.accountOperationalAudit.create({
    data: {
      companyId: actor.companyId,
      actorUserId: actor.id,
      eventType: "STOCK_OPENING",
      entityType: "STOCK_MOVEMENT",
      entityId: row.id,
      metadata: {
        productId: product.id,
        warehouseId: warehouse.id,
        creationRequestKey: extras.creationRequestKey,
      },
    },
  });
}
