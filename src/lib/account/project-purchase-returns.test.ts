import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { stockValuation } from "./inventory-policy";
import { purchaseReturnQuantities } from "./project-purchase-returns";
import {
  projectMaterialBalance,
  projectMaterialCostBreakdown,
  projectRetainedMaterialValue,
} from "./project-material";
const D = (value: string | number) => new Prisma.Decimal(value);
describe("Project supplier returns", () => {
  it("preserves exact quantity across mixed allocations and six-digit rounding", () => {
    const rows = [
      { id: "a", quantity: D(1) },
      { id: "b", quantity: D(1) },
      { id: "inventory", quantity: D(1) },
    ];
    const quantities = purchaseReturnQuantities(D(3), D(1), rows);
    expect(
      [...quantities.values()].reduce((n, x) => n.add(x), D(0)).toString(),
    ).toBe("1");
    expect(quantities.get("inventory")?.toString()).toBe("0.333334");
    expect(() => purchaseReturnQuantities(D(3), D(4), rows)).toThrow(
      "ADJUSTMENT_STOCK_EXCEEDS_SOURCE",
    );
    expect(() =>
      purchaseReturnQuantities(D(3), D(1), rows.slice(0, 2)),
    ).toThrow("INVALID_PURCHASE_ALLOCATION");
  });
  it("keeps company inventory value unchanged when a differently priced Project purchase is received and issued", () => {
    const rows = [
      { movementType: "OPENING" as const, quantity: D(10), unitCost: D(10) },
      {
        movementType: "PURCHASE" as const,
        quantity: D(5),
        unitCost: D("11.8"),
      },
      {
        movementType: "TRANSFER_OUT" as const,
        quantity: D(5),
        unitCost: D("11.8"),
        sourceType: "PROJECT_MATERIAL_ISSUE",
      },
    ];
    expect(stockValuation(rows).quantity.toString()).toBe("10");
    expect(stockValuation(rows).stockValue.toString()).toBe("100");
  });
  it("deducts supplier returns from available and retained value, separately from inventory returns", () => {
    const rows = [
      {
        id: "receipt",
        movementType: "INVENTORY_ISSUE_TO_PROJECT" as const,
        quantity: D(5),
        originalUnitCost: D(10),
        totalCost: D(50),
      },
      {
        id: "return",
        movementType: "RETURN_TO_VENDOR" as const,
        quantity: D(2),
        originalUnitCost: D(10),
        totalCost: D(20),
      },
    ];
    expect(projectMaterialBalance(rows).available.toString()).toBe("3");
    expect(projectRetainedMaterialValue(rows).toString()).toBe("30");
    expect(projectMaterialCostBreakdown(rows).returned.toString()).toBe("0");
    expect(projectMaterialCostBreakdown(rows).returnedToVendor.toString()).toBe(
      "20",
    );
  });
});
