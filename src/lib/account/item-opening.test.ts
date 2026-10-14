import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
}));
import {
  itemCreationExtras,
  itemCreationHash,
  saveItemOpeningInTx,
} from "./item-opening";
import type { ProjectActor } from "./projects";
const warehouseId = "00000000-0000-4000-8000-000000000001",
  key = "00000000-0000-4000-8000-000000000002";
const actor = {
  id: "actor",
  companyId: "company",
  branchAccessScope: "SELECTED_BRANCHES",
  branchIds: ["branch"],
} as ProjectActor;
const calls = {
  warehouse: vi.fn(),
  branch: vi.fn(),
  stock: vi.fn(),
  audit: vi.fn(),
};
const tx = {
  warehouse: { findFirst: calls.warehouse },
  branch: { findFirst: calls.branch },
  stockMovement: { create: calls.stock },
  accountOperationalAudit: { create: calls.audit },
} as unknown as Prisma.TransactionClient;
const extras = (quantity = "2.1250", unitCost = "3.3333") =>
  itemCreationExtras.parse({
    creationRequestKey: key,
    itemLocation: "Shelf one",
    openingStock: {
      warehouseId,
      quantity,
      unitCost,
      movementDate: "2026-10-12",
    },
  });
const product = { id: "product", trackInventory: true, trackingMode: "NONE" };
beforeEach(() => {
  vi.clearAllMocks();
  calls.warehouse.mockResolvedValue({ id: warehouseId, branchId: "branch" });
  calls.branch.mockResolvedValue({ id: "branch" });
  calls.stock.mockResolvedValue({ id: "movement" });
  calls.audit.mockResolvedValue({});
});
it("persists exact opening quantity, independent unit cost and rounded stock value with authorized context", async () => {
  await saveItemOpeningInTx(tx, actor, product, extras());
  const row = calls.stock.mock.calls[0][0].data;
  expect(row.quantity.toString()).toBe("2.125");
  expect(row.unitCost.toString()).toBe("3.3333");
  expect(row.totalCost.toString()).toBe("7.08");
  expect(row).toMatchObject({
    companyId: "company",
    branchId: "branch",
    warehouseId,
    productId: "product",
    sourceType: "ITEM_CREATION",
    sourceId: key,
    sourceLineId: "product",
  });
  expect(calls.audit).toHaveBeenCalledOnce();
});
it("zero or absent opening creates no movement or audit", async () => {
  await saveItemOpeningInTx(tx, actor, product, extras("0"));
  await saveItemOpeningInTx(tx, actor, product, {});
  expect(calls.stock).not.toHaveBeenCalled();
  expect(calls.audit).not.toHaveBeenCalled();
});
it("rejects foreign warehouses, assigned-branch denial and inactive branch without stock writes", async () => {
  calls.warehouse.mockResolvedValue(null);
  await expect(
    saveItemOpeningInTx(tx, actor, product, extras()),
  ).rejects.toThrow();
  calls.warehouse.mockResolvedValue({ id: warehouseId, branchId: "foreign" });
  await expect(
    saveItemOpeningInTx(tx, actor, product, extras()),
  ).rejects.toThrow();
  calls.warehouse.mockResolvedValue({ id: warehouseId, branchId: "branch" });
  calls.branch.mockResolvedValue(null);
  await expect(
    saveItemOpeningInTx(tx, actor, product, extras()),
  ).rejects.toThrow();
  expect(calls.stock).not.toHaveBeenCalled();
});
it("requires retry identity and rejects incompatible tracking", async () => {
  await expect(
    saveItemOpeningInTx(tx, actor, product, {
      ...extras(),
      creationRequestKey: undefined,
    }),
  ).rejects.toThrow("OPENING_REQUEST_KEY_REQUIRED");
  await expect(
    saveItemOpeningInTx(
      tx,
      actor,
      { ...product, trackingMode: "BATCH" },
      extras(),
    ),
  ).rejects.toThrow("INVALID_OPENING_PRODUCT");
});
it("canonicalizes decimal formatting and custom-field order without conflating changed costs", () => {
  const a = extras("1.0000", "2.00"),
    b = extras("1", "2");
  expect(itemCreationHash({ name: "item" }, { b: "2", a: "1" }, a)).toBe(
    itemCreationHash({ name: "item" }, { a: "1", b: "2" }, b),
  );
  expect(itemCreationHash({ name: "item" }, {}, a)).not.toBe(
    itemCreationHash({ name: "item" }, {}, extras("1", "3")),
  );
});
it("rejects negative quantities, nonexistent dates and stock-value overflow", async () => {
  expect(() => extras("-1")).toThrow();
  expect(() =>
    itemCreationExtras.parse({
      ...extras(),
      openingStock: { ...extras().openingStock, movementDate: "2026-02-31" },
    }),
  ).toThrow();
  await expect(
    saveItemOpeningInTx(
      tx,
      actor,
      product,
      extras("99999999999999", "99999999999999"),
    ),
  ).rejects.toThrow("OPENING_VALUE_OUT_OF_RANGE");
  expect(calls.stock).not.toHaveBeenCalled();
});
