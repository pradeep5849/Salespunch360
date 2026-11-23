import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({
  actor: vi.fn(),
  inventory: vi.fn(),
  transaction: vi.fn(),
  user: vi.fn(),
  company: vi.fn(),
  settings: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  saved: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
  requirePermission: m.actor,
  requirePermissionForMutation: m.actor,
}));
vi.mock("./inventory", () => ({ assertInventoryAvailable: m.inventory }));
vi.mock("@/lib/db", () => ({ db: { $transaction: m.transaction } }));
import { editItemMetadata, itemMetadataSchema } from "./item-metadata";
const input = {
  id: "00000000-0000-4000-8000-000000000003",
  expectedUpdatedAt: "2026-11-23T00:00:00.000Z",
  name: " Updated ",
};
const D = (v: string) => new Prisma.Decimal(v);
beforeEach(() => {
  vi.clearAllMocks();
  m.actor.mockResolvedValue({ id: "actor", companyId: "tenant" });
  m.inventory.mockResolvedValue({});
  m.user.mockResolvedValue({ accountRole: "ACCOUNT_ADMIN" });
  m.company.mockResolvedValue({ productEdition: "SALESPUNCH360_PLUS" });
  m.settings.mockResolvedValue({});
  m.find.mockResolvedValue({
    pricing: null,
    salePrice: D("100"),
    costPrice: D("70"),
    taxRate: D("18"),
  });
  m.update.mockResolvedValue({ count: 1 });
  m.saved.mockResolvedValue({
    id: input.id,
    updatedAt: new Date(input.expectedUpdatedAt),
  });
  const model = {
    findFirst: m.find,
    updateMany: m.update,
    findFirstOrThrow: m.saved,
  };
  m.transaction.mockImplementation((fn) =>
    fn({
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      user: { findFirst: m.user },
      company: { findUnique: m.company },
      accountSettings: { findUnique: m.settings },
      accountProduct: model,
      accountService: model,
      workPackage: model,
    }),
  );
});
it.each(["products", "services", "work-packages"] as const)(
  "edits %s only in active company/revision and leaves unrelated data untouched",
  async (kind) => {
    await editItemMetadata(kind, { ...input, code: " abc ", description: " " });
    expect(m.update.mock.calls[0][0]).toEqual({
      where: {
        id: input.id,
        companyId: "tenant",
        isActive: true,
        updatedAt: new Date(input.expectedUpdatedAt),
      },
      data: { name: "Updated", code: "ABC", description: null },
    });
  },
);
it("rejects stale product reads and stale work writes", async () => {
  m.find.mockResolvedValue(null);
  await expect(editItemMetadata("products", input)).rejects.toThrow(
    "ITEM_STALE",
  );
  expect(m.update).not.toHaveBeenCalled();
  m.update.mockResolvedValue({ count: 0 });
  await expect(editItemMetadata("work-packages", input)).rejects.toThrow(
    "ITEM_STALE",
  );
  expect(m.saved).not.toHaveBeenCalled();
});
it.each([null, { accountRole: "ACCOUNT_VIEWER" }])(
  "rechecks current authority after lock",
  async (user) => {
    m.user.mockResolvedValue(user);
    await expect(editItemMetadata("products", input)).rejects.toThrow();
    expect(m.update).not.toHaveBeenCalled();
  },
);
it("rejects changed company edition and disabled item policy", async () => {
  m.company.mockResolvedValue({ productEdition: "SALESPUNCH360" });
  await expect(editItemMetadata("products", input)).rejects.toThrow();
  expect(m.update).not.toHaveBeenCalled();
});
it("rejects cost, units, stock, custom fields and arbitrary keys", async () => {
  for (const key of [
    "cost",
    "unitId",
    "trackInventory",
    "pricing",
    "customFields",
    "companyId",
  ]) {
    await expect(
      editItemMetadata("products", { ...input, [key]: "x" }),
    ).rejects.toThrow();
  }
  expect(m.transaction).not.toHaveBeenCalled();
});
it("preserves inclusive prices, discounts and hidden cost when future sale rate changes", async () => {
  m.find.mockResolvedValue({
    salePrice: D("100"),
    costPrice: D("70"),
    taxRate: D("18"),
    pricing: {
      saleTaxMode: "INCLUSIVE",
      purchaseTaxMode: "INCLUSIVE",
      discountType: "PERCENTAGE",
      discountValue: "5",
      enteredSalePrice: "118.00",
      enteredPurchasePrice: "82.60",
      wholesalePrice: "95",
      mrp: "150",
    },
  });
  await editItemMetadata("products", { ...input, sellingRate: "120" });
  const data = m.update.mock.calls[0][0].data;
  expect(data.salePrice.toString()).toBe("120");
  expect(data.costPrice).toBeUndefined();
  expect(data.pricing).toMatchObject({
    saleTaxMode: "INCLUSIVE",
    purchaseTaxMode: "INCLUSIVE",
    discountValue: "5",
    enteredSalePrice: "141.60",
    enteredPurchasePrice: "82.60",
    wholesalePrice: "95",
    mrp: "150",
  });
});
it("tax-only edit retains exclusive rate and original pricing semantics", async () => {
  m.find.mockResolvedValue({
    sellingRate: D("100"),
    estimatedCost: D("70"),
    taxRate: D("18"),
    pricing: {
      saleTaxMode: "INCLUSIVE",
      purchaseTaxMode: "EXCLUSIVE",
      discountType: "PERCENTAGE",
      discountValue: "0",
      enteredSalePrice: "118.00",
      enteredPurchasePrice: "70.00",
    },
  });
  await editItemMetadata("services", { ...input, taxRate: "12" });
  const data = m.update.mock.calls[0][0].data;
  expect(data.sellingRate.toString()).toBe("100");
  expect(data.pricing.enteredSalePrice).toBe("112.00");
  expect(data.taxRate.toString()).toBe("12");
  expect(data.estimatedCost).toBeUndefined();
});
it("validates exact monetary precision/bounds and work tax rejection", async () => {
  for (const sellingRate of ["-1", "1e3", "1.001", "999999999999999.00", ""]) {
    expect(
      itemMetadataSchema.safeParse({ ...input, sellingRate }).success,
    ).toBe(false);
  }
  expect(
    itemMetadataSchema.safeParse({ ...input, taxRate: "100.01" }).success,
  ).toBe(false);
  await expect(
    editItemMetadata("work-packages", { ...input, taxRate: "18" }),
  ).rejects.toThrow("INVALID_INPUT");
});
