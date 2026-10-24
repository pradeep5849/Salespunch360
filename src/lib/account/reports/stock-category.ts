import {Prisma} from "@prisma/client";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {requireAccountModules} from "../modules";
import {inventorySnapshotForActor, listInventoryProductsForActor} from "../inventory";
import type {FinancialReportContext, ReportResult} from "./service";
const D = Prisma.Decimal.clone({precision: 48});

/** Reuses the stock service's movement valuation, not current master prices.
 * Product units remain separate; no unapproved secondary-unit conversion occurs.
 */
export async function stockCategoryReport(c: FinancialReportContext): Promise<ReportResult> {
  if (!canUsePermission(c.actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_STOCK")) throw new AuthorizationError();
  await requireAccountModules(c.actor, "INVENTORY");
  const actor = c.f.branchId ? {...c.actor, branchAccessScope: "SELECTED_BRANCHES" as const, branchIds: [c.f.branchId]} : c.actor;
  const asOf = new Date(`${c.to.toISOString().slice(0, 10)}T23:59:59.999Z`);
  const [products, snapshot] = await Promise.all([
    listInventoryProductsForActor(actor, {includeInactive: true}),
    inventorySnapshotForActor(actor, asOf),
  ]);
  const amounts = new Map<string, {quantity: Prisma.Decimal; value: Prisma.Decimal}>();
  for (const row of snapshot) {
    const current = amounts.get(row.productId) ?? {quantity: new D(0), value: new D(0)};
    current.quantity = current.quantity.add(row.quantity); current.value = current.value.add(row.stockValue);
    amounts.set(row.productId, current);
  }
  const groups = new Map<string, {category: string; unit: string; quantity: Prisma.Decimal; value: Prisma.Decimal}>();
  for (const product of products) {
    if (!product.trackInventory) continue;
    // Unspecified units cannot establish equivalence between separate products.
    const unitKey = product.unit?.id ?? `unspecified:${product.id}`;
    const key = JSON.stringify([product.category?.id ?? null, unitKey]);
    const group = groups.get(key) ?? {category: product.category?.name ?? "Uncategorized", unit: product.unit?.symbol || product.unit?.name || `Unspecified (${product.name})`, quantity: new D(0), value: new D(0)};
    const amount = amounts.get(product.id);
    if (amount) {group.quantity = group.quantity.add(amount.quantity); group.value = group.value.add(amount.value);}
    groups.set(key, group);
  }
  const rows = [...groups.values()].sort((a, b) => a.category.localeCompare(b.category) || a.unit.localeCompare(b.unit));
  const total = rows.reduce((sum, row) => sum.add(row.value), new D(0));
  return {
    title: "Stock Summary by Item Category", columns: ["Item Category", "Unit", "Stock quantity", "Value"],
    rows: rows.map(row => [row.category, row.unit, row.quantity.toFixed(4), row.value.toFixed(2)]),
    totals: ["Total stock value", "", "", total.toFixed(2)],
    summary: [{label: "Stock Value", value: total.toFixed(2), money: true}],
    note: `Closing stock as of ${asOf.toISOString().slice(0, 10)} (end of day). The start date does not limit stock history. Quantities with different or unspecified units stay separate; values use the existing stock movement valuation. Inactive tracked items are included.`,
  };
}
