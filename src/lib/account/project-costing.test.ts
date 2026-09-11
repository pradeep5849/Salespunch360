import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { packageProfitability, projectCosting } from "./project-costing";
const d = (x: number | string) => new Prisma.Decimal(x);
describe("A8 tax-exclusive costing", () => {
  it("excludes GST and cash movements from project P&L", () => {
    const r = projectCosting({
      originalValue: d(118),
      contractRevenueBase: d(100),
      estimatedCost: d(60),
      budget: d(60),
      closed: true,
      documents: [
        { type: "SALES_INVOICE", status: "POSTED", taxableTotal: d(100) },
        { type: "PURCHASE_BILL", status: "POSTED", taxableTotal: d(60) },
        { type: "CUSTOMER_RECEIPT", status: "POSTED", taxableTotal: d(118) },
        { type: "VENDOR_PAYMENT", status: "POSTED", taxableTotal: d("70.80") },
        { type: "SUBCONTRACT_PURCHASE", status: "POSTED", taxableTotal: d(50) },
      ],
    });
    expect(r.revenue.toString()).toBe("100");
    expect(r.actualCost.toString()).toBe("60");
    expect(r.profit.toString()).toBe("40");
    expect(r.expectedProfit.toString()).toBe("40");
  });
  it.each([
    ["DRAFT", 0],
    ["POSTED", 100],
  ])("only finalized POs commit", (status, remaining) =>
    expect(
      projectCosting({
        originalValue: d(0),
        estimatedCost: d(0),
        budget: d(0),
        documents: [
          { id: "po", type: "PURCHASE_ORDER", status, taxableTotal: d(100) },
        ],
      }).committedCost.toString(),
    ).toBe(String(remaining)),
  );
  it.each([
    [0, 100],
    [40, 60],
    [100, 0],
    [120, 0],
  ])("subtracts posted PO fulfillment %s", (billed, remaining) => {
    const documents = [
      {
        id: "po",
        type: "PURCHASE_ORDER",
        status: "POSTED",
        taxableTotal: d(100),
      },
      ...(billed
        ? [
            {
              type: "PURCHASE_BILL",
              status: "POSTED",
              taxableTotal: d(billed),
              sourcePurchaseOrderId: "po",
            },
          ]
        : []),
    ];
    expect(
      projectCosting({
        originalValue: d(0),
        estimatedCost: d(0),
        budget: d(0),
        documents,
      }).committedCost.toString(),
    ).toBe(String(remaining));
  });
  it("debit notes reduce actual but do not restore commitment", () => {
    const r = projectCosting({
      originalValue: d(0),
      estimatedCost: d(0),
      budget: d(0),
      documents: [
        {
          id: "po",
          type: "PURCHASE_ORDER",
          status: "POSTED",
          taxableTotal: d(100),
        },
        {
          type: "PURCHASE_BILL",
          status: "POSTED",
          taxableTotal: d(100),
          sourcePurchaseOrderId: "po",
        },
        { type: "DEBIT_NOTE", status: "POSTED", taxableTotal: d(20) },
      ],
    });
    expect(r.actualCost.toString()).toBe("80");
    expect(r.committedCost.toString()).toBe("0");
  });
  it("uses tax-exclusive package lines including unassigned", () => {
    const rows = packageProfitability(
      [
        {
          type: "SALES_INVOICE",
          status: "POSTED",
          lines: [
            { workPackageId: "work", taxableAmount: d(100) },
            { workPackageId: null, taxableAmount: d(20) },
          ],
        },
        {
          type: "PURCHASE_BILL",
          status: "POSTED",
          lines: [{ workPackageId: "work", taxableAmount: d(60) }],
        },
      ],
      [
        {
          workPackageId: "work",
          taxableAmount: d(100),
          internalCostTotal: d(60),
        },
      ],
      new Map([["work", "Joinery"]]),
    );
    expect(rows.find((x) => x.id === "work")?.profit.toString()).toBe("40");
    expect(rows.find((x) => x.id === null)?.name).toBe("Other / Unassigned");
  });
});
