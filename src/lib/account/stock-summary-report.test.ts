import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  products: vi.fn(),
  snapshot: vi.fn(),
}));
vi.mock("./inventory-context", () => ({ inventoryContext: mocks.context }));
vi.mock("./inventory", () => ({
  listInventoryProductsForActor: mocks.products,
  inventorySnapshotForActor: mocks.snapshot,
}));
import {
  stockSummaryQuery,
  stockSummaryReportForActor,
} from "./stock-summary-report";
import type { ProjectActor } from "./projects";
const actor = {
  id: "actor",
  companyId: "company",
  accountRole: "ACCOUNT_ADMIN",
} as ProjectActor;
const scoped = {
  ...actor,
  branchAccessScope: "SELECTED_BRANCHES" as const,
  branchIds: ["branch"],
};
describe("shared stock summary dataset", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({
      actor: scoped,
      context: {
        mode: "BRANCH",
        branchId: "branch",
        branchName: "Selected branch",
      },
      asOf: new Date("2026-10-10T23:59:59.999Z"),
    });
    mocks.products.mockResolvedValue([
      {
        id: "inactive",
        name: "Archived stock",
        isActive: false,
        trackInventory: true,
        lowStockThreshold: new Prisma.Decimal(1),
        category: { name: "Steel" },
      },
      {
        id: "active",
        name: "Active stock",
        isActive: true,
        trackInventory: true,
        lowStockThreshold: new Prisma.Decimal(0),
        category: null,
      },
      {
        id: "untracked",
        name: "Service-like item",
        isActive: false,
        trackInventory: false,
        lowStockThreshold: new Prisma.Decimal(0),
        category: null,
      },
    ]);
    mocks.snapshot.mockResolvedValue([
      {
        productId: "inactive",
        quantity: new Prisma.Decimal("0.1"),
        stockValue: new Prisma.Decimal("0.1"),
      },
      {
        productId: "inactive",
        quantity: new Prisma.Decimal("0.2"),
        stockValue: new Prisma.Decimal("0.2"),
      },
      {
        productId: "active",
        quantity: new Prisma.Decimal("-2"),
        stockValue: new Prisma.Decimal("-20"),
      },
    ]);
  });
  it("includes inactive inventory history, aggregates decimals and uses the resolved branch/cutoff", async () => {
    const report = await stockSummaryReportForActor(actor, {
      asOf: "2026-10-10",
      status: "false",
      category: "Steel",
      level: "low",
    });
    expect(mocks.products).toHaveBeenCalledWith(scoped, {
      includeInactive: true,
    });
    expect(mocks.snapshot).toHaveBeenCalledWith(
      scoped,
      new Date("2026-10-10T23:59:59.999Z"),
    );
    expect(report.rows).toHaveLength(2);
    expect(report.filtered).toEqual([
      {
        id: "inactive",
        name: "Archived stock",
        category: "Steel",
        active: false,
        threshold: "1",
        quantity: "0.3",
        value: "0.3",
      },
    ]);
  });
  it("applies the same negative/search/status eligibility to exports", async () => {
    const report = await stockSummaryReportForActor(actor, {
      q: "ACTIVE STOCK",
      level: "negative",
      status: "true",
    });
    expect(report.filtered.map((row) => row.id)).toEqual(["active"]);
  });
  it("rejects invalid calendar dates and filter values before reading stock", async () => {
    for (const query of [
      { asOf: "2026-02-30" },
      { status: "inactive" },
      { level: "other" },
      { branchId: "other-company" },
    ])
      await expect(stockSummaryReportForActor(actor, query)).rejects.toThrow();
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.products).not.toHaveBeenCalled();
    expect(
      stockSummaryQuery.parse({ asOf: "", status: "", q: "  " }),
    ).toMatchObject({ asOf: undefined, status: undefined, q: "" });
  });
  it("propagates denied module/branch context without reading company stock", async () => {
    mocks.context.mockRejectedValue(new Error("DENIED"));
    await expect(stockSummaryReportForActor(actor, {})).rejects.toThrow(
      "DENIED",
    );
    expect(mocks.products).not.toHaveBeenCalled();
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
});
