import { expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { stockValuation } from "./inventory-policy";
import {
  projectMaterialBalance,
  projectMaterialIssueValue,
} from "./project-material";
const D = (value: string) => new Prisma.Decimal(value);
it("retains posted value when stored unit cost has less precision than the total", () => {
  const result = stockValuation([
    {
      movementType: "PURCHASE",
      quantity: D("1000"),
      unitCost: D("0.0112"),
      totalCost: D("11.21"),
    },
  ]);
  expect(result.stockValue.toString()).toBe("11.21");
});
it("uses recorded transfer totals to conserve company value at fractional unit costs", () => {
  const result = stockValuation([
    {
      movementType: "PURCHASE",
      quantity: D("1000"),
      unitCost: D("0.0112"),
      totalCost: D("11.21"),
    },
    {
      movementType: "TRANSFER_OUT",
      sourceType: "PROJECT_MATERIAL_ISSUE",
      quantity: D("1000"),
      unitCost: D("0.0112"),
      totalCost: D("11.21"),
    },
  ]);
  expect(result.quantity.toString()).toBe("0");
  expect(result.stockValue.toString()).toBe("0");
});
it("retains the final receipt cent after a partially consumed Project material", () => {
  const balance = projectMaterialBalance([
    {
      id: "receipt",
      movementType: "DIRECT_PROJECT_RECEIPT",
      quantity: D("3"),
      originalUnitCost: D("3.3367"),
      totalCost: D("10.01"),
    },
    {
      id: "consumption",
      movementType: "CONSUMPTION",
      quantity: D("1"),
      originalUnitCost: D("3.3367"),
      totalCost: D("3.34"),
    },
  ]);
  expect(balance.availableValue.toString()).toBe("6.67");
});

it("allocates the remaining value rather than multiplying a rounded original unit cost", () => {
  const rows = [
    {
      id: "receipt",
      movementType: "DIRECT_PROJECT_RECEIPT" as const,
      quantity: D("3"),
      originalUnitCost: D("3.3367"),
      totalCost: D("10.01"),
    },
    {
      id: "consumption",
      movementType: "CONSUMPTION" as const,
      quantity: D("1"),
      originalUnitCost: D("3.3367"),
      totalCost: D("3.34"),
    },
  ];
  expect(projectMaterialIssueValue(rows, D("2")).toString()).toBe("6.67");
  expect(() => projectMaterialIssueValue(rows, D("3"))).toThrow(
    "INSUFFICIENT_PROJECT_MATERIAL",
  );
});
