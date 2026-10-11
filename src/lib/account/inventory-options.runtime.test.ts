import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  settings: vi.fn(),
  branch: vi.fn(),
  warehouse: vi.fn(),
  product: vi.fn(),
  customer: vi.fn(),
  batch: vi.fn(),
  serial: vi.fn(),
  module: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    accountSettings: { findUnique: mocks.settings },
    branch: { findMany: mocks.branch },
    warehouse: { findMany: mocks.warehouse },
    accountProduct: { findMany: mocks.product },
    customer: { findMany: mocks.customer },
    inventoryBatch: { findMany: mocks.batch },
    inventorySerialNumber: { findMany: mocks.serial },
  },
}));
vi.mock("@/lib/account/modules", () => ({
  requireAccountModules: mocks.module,
}));
import { inventoryOptionsForActor } from "./inventory";
const company = "00000000-0000-4000-8000-000000000001",
  branch = "00000000-0000-4000-8000-000000000002";
const actor = {
  companyId: company,
  branchAccessScope: "SELECTED_BRANCHES",
  branchIds: [branch],
} as never;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.settings.mockResolvedValue({ itemSettings: { enabled: true } });
  mocks.module.mockResolvedValue(undefined);
  mocks.branch.mockResolvedValue([{ id: branch }]);
  for (const fn of [
    mocks.warehouse,
    mocks.product,
    mocks.customer,
    mocks.batch,
    mocks.serial,
  ])
    fn.mockResolvedValue([]);
});
describe("A054 section-specific inventory options", () => {
  it("warehouse setup reads only the authorized branches", async () => {
    const options = await inventoryOptionsForActor(actor, "warehouses");
    expect(options.branches).toEqual([{ id: branch }]);
    expect(mocks.branch).toHaveBeenCalledWith({
      where: { companyId: company, isActive: true, id: { in: [branch] } },
      orderBy: { name: "asc" },
    });
    for (const fn of [
      mocks.warehouse,
      mocks.product,
      mocks.customer,
      mocks.batch,
      mocks.serial,
    ])
      expect(fn).not.toHaveBeenCalled();
  });
  it("batch/serial setup loads products without unrelated customer/warehouse catalogues", async () => {
    await inventoryOptionsForActor(actor, "batches");
    expect(mocks.product).toHaveBeenCalledOnce();
    for (const fn of [
      mocks.branch,
      mocks.warehouse,
      mocks.customer,
      mocks.batch,
      mocks.serial,
    ])
      expect(fn).not.toHaveBeenCalled();
  });
  it("stock views load authorized warehouse names and products only", async () => {
    await inventoryOptionsForActor(actor, "stock");
    expect(mocks.warehouse).toHaveBeenCalledWith({
      where: { companyId: company, isActive: true, branchId: { in: [branch] } },
      orderBy: { name: "asc" },
    });
    expect(mocks.product).toHaveBeenCalledOnce();
    for (const fn of [mocks.customer, mocks.batch, mocks.serial])
      expect(fn).not.toHaveBeenCalled();
  });
  it("Items OFF rejects before any option catalogue read", async () => {
    mocks.settings.mockResolvedValue({ itemSettings: { enabled: false } });
    await expect(inventoryOptionsForActor(actor, "all")).rejects.toThrow(
      "ITEMS_DISABLED",
    );
    for (const fn of [
      mocks.branch,
      mocks.warehouse,
      mocks.product,
      mocks.customer,
      mocks.batch,
      mocks.serial,
    ])
      expect(fn).not.toHaveBeenCalled();
  });
});
