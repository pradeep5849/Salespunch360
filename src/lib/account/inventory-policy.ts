import { Prisma, type StockMovementType } from "@prisma/client";
const Z = new Prisma.Decimal(0);
const IN = new Set<StockMovementType>([
  "OPENING",
  "PURCHASE",
  "SALES_RETURN",
  "TRANSFER_IN",
  "ADJUSTMENT_IN",
]);
export const isInboundStockMovement = (type: StockMovementType) => IN.has(type);
export const signedQuantity = (
  type: StockMovementType,
  quantity: Prisma.Decimal,
) => (isInboundStockMovement(type) ? quantity : quantity.neg());
export function stockValuation(
  rows: Array<{
    movementType: StockMovementType;
    quantity: Prisma.Decimal;
    unitCost: Prisma.Decimal;
  }>,
) {
  let quantity = Z,
    value = Z;
  for (const row of rows) {
    const q = signedQuantity(row.movementType, row.quantity);
    if (q.gte(0)) {
      quantity = quantity.add(q);
      value = value.add(q.mul(row.unitCost));
    } else {
      const average = quantity.gt(0) ? value.div(quantity) : row.unitCost;
      quantity = quantity.add(q);
      value = value.add(q.mul(average));
    }
  }
  return {
    quantity,
    averageUnitCost: quantity.gt(0)
      ? value.div(quantity).toDecimalPlaces(4)
      : Z,
    stockValue: value.toDecimalPlaces(2),
  };
}
export function chooseProductRate(input: {
  customerRate?: Prisma.Decimal | null;
  tierRate?: Prisma.Decimal | null;
  defaultRate?: Prisma.Decimal | null;
}) {
  return input.customerRate ?? input.tierRate ?? input.defaultRate ?? Z;
}
export function itemProfitability(
  revenue: Prisma.Decimal,
  cogs: Prisma.Decimal,
) {
  return {
    revenue,
    cogs,
    profit: revenue.sub(cogs),
    marginPercent: revenue.isZero()
      ? Z
      : revenue.sub(cogs).div(revenue).mul(100),
  };
}
