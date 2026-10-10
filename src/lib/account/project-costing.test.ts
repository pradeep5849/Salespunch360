import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  packageProfitability,
  projectCosting,
  projectAllocatedPurchaseMetrics,
  inventoryIssueCostNotPurchased,
} from "./project-costing";
const d = (x: number | string) => new Prisma.Decimal(x);
describe("A8 tax-exclusive costing", () => {
  it("reconciles the user's contract, extra job, invoices, labour and leftover transfer without adding advances to profit", () => {
    const result = projectCosting({
      originalValue: d(100000),
      estimatedCost: d(0),
      budget: d(0),
      approvedChanges: [{ valueDelta: d(10000), estimatedCostDelta: d(0) }],
      documents: [
        { type: "SALES_INVOICE", status: "POSTED", taxableTotal: d(50000) },
        { type: "SALES_INVOICE", status: "POSTED", taxableTotal: d(50000) },
      ],
      allocatedPurchaseCost: d(30000),
      expenses: [d(20000), d(5000)],
      advanceReceived: d(20000),
      materialAdjustments: {
        inventoryIssued: d(0),
        transferIn: d(0),
        returned: d(0),
        transferOut: d(5000),
        consumed: d(25000),
        unused: d(0),
      },
    });
    expect(result.contractRevenueBase.toString()).toBe("110000");
    expect(result.actualCost.toString()).toBe("50000");
    expect(result.expenseCost.toString()).toBe("25000");
    expect(result.contractProfit.toString()).toBe("60000");
    expect(result.profit.toString()).toBe("50000");
    expect(result.unbilledContractRevenue.toString()).toBe("10000");
  });
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

describe("Project allocated purchase cost and commitments", () => {
  const row = (
    id: string,
    type: string,
    value: number,
    po: string | null = null,
    eligible = true,
  ) => ({
    documentLineId: `${id}-line`,
    taxableAmount: d(value),
    taxAmount: d(value * 0.18),
    quantity: d(value / 10),
    documentLine: {
      taxableAmount: d(value * 2),
      quantity: d(value / 5),
      document: {
        id,
        type,
        status: "POSTED",
        sourcePurchaseOrderId: po,
        taxCreditTreatment: eligible ? "ELIGIBLE" : "BLOCKED",
      },
    },
  });
  it("nets project allocated bills from POs rather than committing both", () => {
    const result = projectAllocatedPurchaseMetrics(
      [
        row("po", "PURCHASE_ORDER", 100),
        row("bill", "PURCHASE_BILL", 40, "po"),
      ],
      [],
    );
    expect(result.actual.toString()).toBe("40");
    expect(result.committed.toString()).toBe("60");
  });
  it("apportions posted debit notes to this project without restoring fulfilled commitments", () => {
    const result = projectAllocatedPurchaseMetrics(
      [
        row("po", "PURCHASE_ORDER", 100),
        row("bill", "PURCHASE_BILL", 100, "po"),
      ],
      [
        {
          sourceCommercialLineId: "bill-line",
          taxableAmount: d(40),
          taxAmount: d(7.2),
          quantity: d(4),
        },
      ],
    );
    expect(result.actual.toString()).toBe("80");
    expect(result.committed.toString()).toBe("0");
  });
  it("includes non-recoverable GST in original and adjusted project cost", () => {
    const result = projectAllocatedPurchaseMetrics(
      [row("bill", "PURCHASE_BILL", 100, null, false)],
      [
        {
          sourceCommercialLineId: "bill-line",
          taxableAmount: d(40),
          taxAmount: d(7.2),
          quantity: d(4),
        },
      ],
    );
    expect(result.actual.toString()).toBe("94.4");
  });
});

describe("Project purchase material costing", () => {
  it("counts purchase allocation cost once while retaining independent inventory issues", () => {
    const row = (
      id: string,
      purchaseAllocationId: string | null,
      cost: number,
    ) => ({
      id,
      purchaseAllocationId,
      totalCost: d(cost),
      movementType: "INVENTORY_ISSUE_TO_PROJECT",
      reversalOfId: null,
    });
    expect(
      inventoryIssueCostNotPurchased([
        row("purchase", "allocation", 50),
        row("inventory", null, 20),
      ]).toString(),
    ).toBe("20");
    expect(
      inventoryIssueCostNotPurchased([
        row("inventory", null, 20),
        {
          ...row("reversal", null, 20),
          movementType: "REVERSAL",
          reversalOfId: "inventory",
        },
      ]).toString(),
    ).toBe("0");
  });
});
