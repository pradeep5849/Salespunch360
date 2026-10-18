import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {assertInventoryAvailable} from "../inventory";
import {isInboundStockMovement, signedQuantity} from "../inventory-policy";
import {reportQuantity} from "./quantity";
import type {FinancialReportContext, ReportResult} from "./service";
const D = Prisma.Decimal.clone({precision: 48});

/** Quantity-only movement report. The same repeatable-read snapshot supplies
 * metadata, opening history and period movements, so closing = opening + in - out.
 * No secondary-unit conversion or inventory/accounting write is performed.
 */
export async function stockDetailReport(c: FinancialReportContext): Promise<ReportResult> {
  if (!canUsePermission(c.actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_STOCK")) throw new AuthorizationError();
  await assertInventoryAvailable(c.actor);
  const from = new Date(`${c.from.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const to = new Date(`${c.to.toISOString().slice(0, 10)}T23:59:59.999Z`);
  return db.$transaction(async tx => {
    let categoryName = "All categories";
    if (c.f.categoryId === "UNCATEGORIZED") categoryName = "Uncategorized (no category)";
    else if (c.f.categoryId) {
      const category = await tx.accountCategory.findFirst({where: {companyId: c.actor.companyId, id: c.f.categoryId}, select: {id: true, name: true}});
      if (!category) throw new AuthorizationError();
      categoryName = category.name;
    }
    const products = await tx.accountProduct.findMany({where: {companyId: c.actor.companyId, trackInventory: true, ...(c.f.categoryId ? {categoryId: c.f.categoryId === "UNCATEGORIZED" ? null : c.f.categoryId} : {}), ...(c.f.itemStatus ? {isActive: c.f.itemStatus === "ACTIVE"} : {})}, include: {unit: true, category: true}, orderBy: [{name: "asc"}, {id: "asc"}]});
    const warehouses = await tx.warehouse.findMany({where: {companyId: c.actor.companyId, isActive: true, ...c.branch}, select: {id: true}});
    const amounts = new Map(products.map(product => [product.id, {opening: new D(0), incoming: new D(0), outgoing: new D(0)}]));
    let cursor: string | undefined;
    for (;;) {
      const movements = await tx.stockMovement.findMany({
        where: {companyId: c.actor.companyId, warehouseId: {in: warehouses.map(row => row.id)}, movementDate: {lte: to}},
        select: {id: true, productId: true, movementType: true, quantity: true, movementDate: true},
        orderBy: {id: "asc"}, take: 1000, ...(cursor ? {cursor: {id: cursor}, skip: 1} : {}),
      });
      for (const movement of movements) {
        const amount = amounts.get(movement.productId);
        if (!amount) continue;
        if (movement.movementDate < from) amount.opening = amount.opening.add(signedQuantity(movement.movementType, movement.quantity));
        else if (isInboundStockMovement(movement.movementType)) amount.incoming = amount.incoming.add(movement.quantity);
        else amount.outgoing = amount.outgoing.add(movement.quantity);
      }
      if (movements.length < 1000) break;
      cursor = movements[movements.length - 1].id;
    }
    const totals = {opening: new Map<string, Prisma.Decimal>(), incoming: new Map<string, Prisma.Decimal>(), outgoing: new Map<string, Prisma.Decimal>(), closing: new Map<string, Prisma.Decimal>()};
    const rows = products.map(product => {
      const amount = amounts.get(product.id)!;
      const values = {...amount, closing: amount.opening.add(amount.incoming).sub(amount.outgoing)};
      const key = JSON.stringify([product.unit?.name ?? "", product.unit?.symbol ?? "", product.unit?.id ?? product.id]);
      for (const field of ["opening", "incoming", "outgoing", "closing"] as const) totals[field].set(key, (totals[field].get(key) ?? new D(0)).add(values[field]));
      return [product.name, product.category?.name ?? "Uncategorized", product.unit?.symbol || product.unit?.name || "Unit unspecified", values.opening.toFixed(4), values.incoming.toFixed(4), values.outgoing.toFixed(4), values.closing.toFixed(4)];
    });
    return {
      title: "Stock Detail Report", columns: ["Item", "Category", "Unit", "Beginning Qty", "Qty In", "Qty Out", "Closing Qty"], rows,
      summary: [
        {label: "Closing Quantity", value: reportQuantity(totals.closing), money: false},
        {label: "Beginning Quantity", value: reportQuantity(totals.opening), money: false},
        {label: "Quantity In", value: reportQuantity(totals.incoming), money: false},
        {label: "Quantity Out", value: reportQuantity(totals.outgoing), money: false},
      ],
      note: `Category: ${categoryName}. Item status: ${c.f.itemStatus ?? "All"}. Category and status use current item metadata. Closing = beginning + quantity in - quantity out. Includes inactive tracked items and all opening history before the selected start date, using the same active-warehouse scope as Stock Summary. Mixed or unspecified units are not added together; item quantities retain four decimals. This report does not change stock or the ledger.`,
    };
  }, {isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000});
}
