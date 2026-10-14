import { Prisma } from "@prisma/client";

type UnitSnapshot = { id?: string; unitName: string | null; unitSymbol: string | null };
export const reportUnitKey = (unit: UnitSnapshot) =>
  JSON.stringify([unit.unitName ?? "", unit.unitSymbol ?? "", unit.unitName || unit.unitSymbol ? "" : (unit.id ?? "")]);

/** A report must not silently add physical quantities with different units. */
export function reportQuantity(quantities: Map<string, Prisma.Decimal>): string {
  if (quantities.size !== 1) return quantities.size ? "Mixed units" : "—";
  const [key, quantity] = [...quantities][0];
  const [name, symbol] = JSON.parse(key) as [string, string];
  return `${quantity.toFixed(4)} ${symbol || name || "(unit unspecified)"}`;
}
