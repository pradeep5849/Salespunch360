import { Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import {
  chooseProductRate,
  itemProfitability,
  stockValuation,
} from "./inventory-policy";
const decimal = (value: string | number) => new Prisma.Decimal(value);
it("retains explicit zero negotiated rates instead of using the fallback price", () => {
  expect(
    chooseProductRate({
      customerRate: decimal(0),
      tierRate: decimal(20),
      defaultRate: decimal(30),
    }).toString(),
  ).toBe("0");
  expect(
    chooseProductRate({
      customerRate: null,
      tierRate: decimal(0),
      defaultRate: decimal(30),
    }).toString(),
  ).toBe("0");
  expect(
    chooseProductRate({
      customerRate: null,
      tierRate: null,
      defaultRate: decimal(30),
    }).toString(),
  ).toBe("30");
  expect(chooseProductRate({})).toEqual(decimal(0));
});
it("reports a loss with zero revenue without dividing by zero", () => {
  const result = itemProfitability(decimal(0), decimal(15));
  expect(result.profit.toString()).toBe("-15");
  expect(result.marginPercent.toString()).toBe("0");
});
it("returns stable zero valuation for an empty movement history", () => {
  const result = stockValuation([]);
  expect(result.quantity.isZero()).toBe(true);
  expect(result.averageUnitCost.isZero()).toBe(true);
  expect(result.stockValue.isZero()).toBe(true);
});
it("preserves decimal weighted cost through an outward movement", () => {
  const result = stockValuation([
    {
      movementType: "PURCHASE",
      quantity: decimal(3),
      unitCost: decimal("10.005"),
    },
    { movementType: "SALE", quantity: decimal(1), unitCost: decimal(99) },
  ]);
  expect(result.quantity.toString()).toBe("2");
  expect(result.averageUnitCost.toString()).toBe("10.005");
  expect(result.stockValue.toString()).toBe("20.01");
});
it("values an allowed negative opening adjustment using its recorded cost", () => {
  const result = stockValuation([
    {
      movementType: "ADJUSTMENT_OUT",
      quantity: decimal(2),
      unitCost: decimal(10),
    },
  ]);
  expect(result.quantity.toString()).toBe("-2");
  expect(result.stockValue.toString()).toBe("-20");
  expect(result.averageUnitCost.isZero()).toBe(true);
});
it("keeps Project transfer bridges neutral at a different original Project cost", () => {
  const rows = [
    {
      movementType: "OPENING" as const,
      quantity: decimal(10),
      unitCost: decimal(10),
    },
    {
      movementType: "TRANSFER_IN" as const,
      sourceType: "PROJECT_TRANSFER_RETURN",
      quantity: decimal(5),
      unitCost: decimal(5),
    },
    {
      movementType: "TRANSFER_OUT" as const,
      sourceType: "PROJECT_TRANSFER_ISSUE",
      quantity: decimal(5),
      unitCost: decimal(5),
    },
  ];
  const result = stockValuation(rows);
  expect(result.quantity.toString()).toBe("10");
  expect(result.stockValue.toString()).toBe("100");
  expect(result.averageUnitCost.toString()).toBe("10");
});
it("reverses a Project return at its original value while preserving normal outbound weighted cost", () => {
  const before = [
    {
      movementType: "OPENING" as const,
      quantity: decimal(10),
      unitCost: decimal(10),
    },
    {
      movementType: "TRANSFER_IN" as const,
      quantity: decimal(5),
      unitCost: decimal(5),
    },
  ];
  expect(
    stockValuation([
      ...before,
      {
        movementType: "TRANSFER_OUT",
        sourceType: "PROJECT_MATERIAL_REVERSAL",
        quantity: decimal(5),
        unitCost: decimal(5),
      },
    ]).stockValue.toString(),
  ).toBe("100");
  expect(
    stockValuation([
      ...before,
      { movementType: "SALE", quantity: decimal(5), unitCost: decimal(5) },
    ]).stockValue.toString(),
  ).toBe("83.33");
});
