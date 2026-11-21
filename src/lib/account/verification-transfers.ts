import { Prisma } from "@prisma/client";
type Movement = { id: string; sourceId: string | null; movementType: string; productId: string; warehouseId: string; quantity: Prisma.Decimal };
/** Reconcile each product within a source; never offset one product against another. */
export function mismatchedTransferSources(movements: Movement[]): string[] {
  const groups = new Map<string, Map<string, Movement[]>>();
  for (const row of movements) {
    if (row.movementType !== "TRANSFER_IN" && row.movementType !== "TRANSFER_OUT") continue;
    const source = row.sourceId ?? row.id;
    const products = groups.get(source) ?? new Map<string, Movement[]>();
    products.set(row.productId, [...(products.get(row.productId) ?? []), row]);
    groups.set(source, products);
  }
  return [...groups].filter(([, products]) => [...products.values()].some(rows => {
    const incoming = rows.filter(x => x.movementType === "TRANSFER_IN");
    const outgoing = rows.filter(x => x.movementType === "TRANSFER_OUT");
    const total = (items: Movement[]) => items.reduce((sum, x) => sum.add(x.quantity), new Prisma.Decimal(0));
    return !incoming.length || !outgoing.length || rows.some(x => x.quantity.lte(0)) || !total(incoming).equals(total(outgoing)) || incoming.some(x => outgoing.some(y => x.warehouseId === y.warehouseId));
  })).map(([source]) => source);
}
