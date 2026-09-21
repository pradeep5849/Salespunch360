import { canUsePermission } from "@/lib/auth/permissions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  createBatchForActor,
  createProductPriceForActor,
  createStockMovementForActor,
  inventoryOptionsForActor,
  inventorySnapshotForActor,
  listBatchesForActor,
  listInventoryProductsForActor,
  listProductPricesForActor,
  listSerialNumbersForActor,
  listWarehousesForActor,
  lowStockSnapshotForActor,
  registerSerialNumberForActor,
  transferStockForActor,
} from "@/lib/account/inventory";
import { db } from "@/lib/db";
import { mobileAccountActor } from "./account-transactions";
import type { MobileAppPrincipal } from "./auth";
import type { StockMovementType } from "@prisma/client";
function permit(u: MobileAppPrincipal, write = false) {
  const a = mobileAccountActor(u);
  if (!canUsePermission(a, u.productEdition, "ACCOUNT_STOCK"))
    throw new Error("MOBILE_FORBIDDEN");
  if (a.accountRole === "PROJECT_MANAGER") throw new Error("MOBILE_FORBIDDEN");
  return a;
}
export async function mobileInventoryOptions(u: MobileAppPrincipal) {
  return inventoryOptionsForActor(permit(u));
}
export async function mobileStock(u: MobileAppPrincipal) {
  const a = permit(u),
    [snapshot, products, warehouses] = await Promise.all([
      inventorySnapshotForActor(a),
      listInventoryProductsForActor(a),
      listWarehousesForActor(a),
    ]),
    p = new Map(products.map((x) => [x.id, x])),
    w = new Map(warehouses.map((x) => [x.id, x]));
  return snapshot.map((x) => ({
    ...x,
    product: p.get(x.productId),
    warehouse: w.get(x.warehouseId),
  }));
}
export async function mobileLowStock(u: MobileAppPrincipal) {
  return lowStockSnapshotForActor(permit(u));
}
export async function mobileInventoryCatalog(
  u: MobileAppPrincipal,
  kind: string,
) {
  const a = permit(u);
  if (kind === "batches") return listBatchesForActor(a);
  if (kind === "serials") return listSerialNumbersForActor(a);
  if (kind === "prices") return listProductPricesForActor(a);
  throw new Error("INVALID_INPUT");
}
export async function mobileCreateInventoryCatalog(
  u: MobileAppPrincipal,
  kind: string,
  raw: unknown,
) {
  const a = permit(u, true);
  await assertOperationalWrite(u.companyId);
  if (kind === "batches") return createBatchForActor(a, raw);
  if (kind === "serials") return registerSerialNumberForActor(a, raw);
  if (kind === "prices") return createProductPriceForActor(a, raw);
  throw new Error("INVALID_INPUT");
}
export async function mobileInventoryHistory(
  u: MobileAppPrincipal,
  type?: string,
) {
  const a = permit(u),
    warehouses = await listWarehousesForActor(a);
  return db.stockMovement.findMany({
    where: {
      companyId: a.companyId,
      warehouseId: { in: warehouses.map((x) => x.id) },
      ...(type ? { movementType: type as StockMovementType } : {}),
    },
    orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
}
export async function mobileOpening(u: MobileAppPrincipal, raw: unknown) {
  const a = permit(u, true);
  await assertOperationalWrite(u.companyId);
  const d = raw as Record<string, unknown>;
  return createStockMovementForActor(a, "OPENING", {
    ...d,
    sourceType: "OPENING_STOCK",
    sourceId: crypto.randomUUID(),
  });
}
export async function mobileAdjustment(u: MobileAppPrincipal, raw: unknown) {
  const a = permit(u, true);
  await assertOperationalWrite(u.companyId);
  const d = raw as Record<string, unknown>,
    direction = d.direction;
  if (direction !== "IN" && direction !== "OUT")
    throw new Error("INVALID_INPUT");
  const { direction: _ignored, ...input } = d;
  return createStockMovementForActor(
    a,
    direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
    { ...input, sourceType: "STOCK_ADJUSTMENT", sourceId: crypto.randomUUID() },
  );
}
export async function mobileTransfer(u: MobileAppPrincipal, raw: unknown) {
  const a = permit(u, true);
  await assertOperationalWrite(u.companyId);
  return transferStockForActor(a, raw);
}
