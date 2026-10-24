import { Prisma } from "@prisma/client";
import { z } from "zod";
import { inventoryContext } from "./inventory-context";
import {
  inventorySnapshotForActor,
  listInventoryProductsForActor,
} from "./inventory";
import type { ProjectActor } from "./projects";

const optional = (schema: z.ZodString) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    schema.optional(),
  );
export const stockSummaryQuery = z.object({
  branchId: optional(z.string().guid()),
  scope: optional(z.string().regex(/^all$/)),
  asOf: optional(z.string().date()),
  q: optional(z.string().trim().max(240)),
  category: optional(z.string().max(240)),
  level: optional(z.string().regex(/^(available|low|negative)$/)),
  status: optional(z.string().regex(/^(true|false)$/)),
});
export type StockSummaryQuery = z.input<typeof stockSummaryQuery>;
export async function stockSummaryReportForActor(
  actor: ProjectActor,
  raw: StockSummaryQuery,
) {
  const query = stockSummaryQuery.parse(raw);
  const scoped = await inventoryContext(actor, query);
  const [products, snapshot] = await Promise.all([
    listInventoryProductsForActor(scoped.actor, { includeInactive: true }),
    inventorySnapshotForActor(scoped.actor, scoped.asOf),
  ]);
  const totals = new Map<
    string,
    { quantity: Prisma.Decimal; value: Prisma.Decimal }
  >();
  for (const row of snapshot) {
    const total = totals.get(row.productId) ?? {
      quantity: new Prisma.Decimal(0),
      value: new Prisma.Decimal(0),
    };
    totals.set(row.productId, {
      quantity: total.quantity.add(row.quantity),
      value: total.value.add(row.stockValue),
    });
  }
  const rows = products
    .filter((product) => product.trackInventory)
    .map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category?.name ?? "Uncategorised",
      active: product.isActive,
      threshold: product.lowStockThreshold.toFixed(),
      quantity: (
        totals.get(product.id)?.quantity ?? new Prisma.Decimal(0)
      ).toFixed(),
      value: (totals.get(product.id)?.value ?? new Prisma.Decimal(0)).toFixed(),
    }));
  const filtered = rows.filter((row) => {
    const quantity = new Prisma.Decimal(row.quantity);
    return (
      row.name.toLowerCase().includes(query.q?.toLowerCase() ?? "") &&
      (!query.category || row.category === query.category) &&
      (!query.status || String(row.active) === query.status) &&
      (!query.level ||
        (query.level === "negative"
          ? quantity.lt(0)
          : query.level === "low"
            ? quantity.lte(row.threshold)
            : quantity.gt(row.threshold)))
    );
  });
  return { rows, filtered, query, context: scoped.context };
}
