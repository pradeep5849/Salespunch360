import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
const state = vi.hoisted(() => ({ actor: {} as Record<string, unknown> }));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
  requirePermission: async () => state.actor,
  requirePermissionForMutation: async () => state.actor,
}));
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_, key) => {
        const value = client[key as keyof PrismaClient];
        return typeof value === "function" ? value.bind(client) : value;
      },
    },
  ),
}));
import { editItemMetadata, itemMetadataForEdit } from "./item-metadata";
const address = process.env.ITEM_EDITOR_TEST_DATABASE_URL,
  url = new URL(address ?? "postgresql://unused:unused@127.0.0.1/unused_ci");
if (
  address &&
  (!["127.0.0.1", "localhost"].includes(url.hostname) ||
    !url.pathname.endsWith("_ci"))
)
  throw new Error("ISOLATED_LOCAL_CI_DATABASE_REQUIRED");
const client = new PrismaClient({ datasourceUrl: address ?? url.toString() });
const companyId = randomUUID(),
  ownerId = randomUUID(),
  foreign = randomUUID();
beforeAll(async () => {
  if (!address) return;
  await client.company.create({
    data: {
      id: companyId,
      name: "Item editor fixture",
      slug: `item-edit-${companyId}`,
      productEdition: "SALESPUNCH360_PLUS",
    },
  });
  await client.user.create({
    data: {
      id: ownerId,
      companyId,
      name: "Owner",
      email: `${ownerId}@example.invalid`,
      passwordHash: "PRIVATE",
      role: "COMPANY_ADMIN",
      salesRole: "PRIMARY_ADMIN",
      accountRole: "ACCOUNT_ADMIN",
      accountAccessActive: true,
    },
  });
  await client.company.create({
    data: {
      id: foreign,
      name: "Foreign",
      slug: `item-edit-${foreign}`,
      productEdition: "SALESPUNCH360_PLUS",
    },
  });
  state.actor = {
    id: ownerId,
    companyId,
    accountRole: "ACCOUNT_ADMIN",
    isActive: true,
    accountAccessActive: true,
  };
});
afterAll(async () => client.$disconnect());
it.skipIf(!address)(
  "preserves inventory, costs, identifiers and advanced pricing across a sale edit",
  async () => {
    const p = await client.accountProduct.create({
      data: {
        companyId,
        name: "Product",
        code: "P1",
        salePrice: "100",
        costPrice: "70",
        taxRate: "18",
        trackInventory: true,
        trackingMode: "BATCH",
        barcode: randomUUID(),
        lowStockThreshold: "5",
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
      },
    });
    await editItemMetadata("products", {
      id: p.id,
      expectedUpdatedAt: p.updatedAt.toISOString(),
      name: "Updated",
      sellingRate: "125",
    });
    const saved = await client.accountProduct.findUniqueOrThrow({
      where: { id: p.id },
    });
    expect(saved.salePrice?.toString()).toBe("125");
    expect(saved.costPrice?.toString()).toBe("70");
    expect(saved.trackInventory).toBe(true);
    expect(saved.trackingMode).toBe("BATCH");
    expect(saved.barcode).toBe(p.barcode);
    expect(saved.code).toBe("P1");
    expect(saved.lowStockThreshold.toString()).toBe("5");
    expect(saved.pricing).toMatchObject({
      enteredSalePrice: "147.50",
      enteredPurchasePrice: "82.60",
      discountValue: "5",
      mrp: "150",
    });
  },
);
it.skipIf(!address)(
  "only one concurrent editor saves a reviewed revision",
  async () => {
    const row = await client.accountService.create({
      data: {
        companyId,
        name: "Service",
        sellingRate: "200",
        estimatedCost: "100",
      },
    });
    const raw = {
      id: row.id,
      expectedUpdatedAt: row.updatedAt.toISOString(),
      name: "One",
    };
    const results = await Promise.allSettled([
      editItemMetadata("services", raw),
      editItemMetadata("services", { ...raw, name: "Two" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  },
);
it.skipIf(!address)(
  "rejects foreign and inactive rows and never leaks costs through the read DTO",
  async () => {
    const f = await client.accountService.create({
      data: { companyId: foreign, name: "Secret", estimatedCost: "999" },
    });
    await expect(itemMetadataForEdit("services", f.id)).rejects.toThrow(
      "ITEM_NOT_FOUND",
    );
    await expect(
      editItemMetadata("services", {
        id: f.id,
        expectedUpdatedAt: f.updatedAt.toISOString(),
        name: "Bad",
      }),
    ).rejects.toThrow("ITEM_STALE");
    const own = await client.accountService.create({
      data: { companyId, name: "Own", estimatedCost: "123" },
    });
    const dto = await itemMetadataForEdit("services", own.id);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "code",
        "description",
        "id",
        "name",
        "sellingRate",
        "taxRate",
        "updatedAt",
      ].sort(),
    );
    await client.accountService.update({
      where: { id: own.id },
      data: { isActive: false },
    });
    await expect(itemMetadataForEdit("services", own.id)).rejects.toThrow(
      "ITEM_NOT_FOUND",
    );
  },
);
it.skipIf(!address)(
  "work edit preserves category, unit and estimated costs",
  async () => {
    const category = await client.workCategory.create({
      data: { companyId, name: `Category-${randomUUID()}` },
    });
    const unit = await client.accountUnit.create({
      data: {
        companyId,
        name: `Unit-${randomUUID()}`,
        symbol: randomUUID().slice(0, 8),
      },
    });
    const row = await client.workPackage.create({
      data: {
        companyId,
        name: "Work",
        workCategoryId: category.id,
        unitId: unit.id,
        estimatedCost: "200",
        sellingRate: "300",
      },
    });
    await editItemMetadata("work-packages", {
      id: row.id,
      expectedUpdatedAt: row.updatedAt.toISOString(),
      name: "Revised work",
      sellingRate: "400",
    });
    const saved = await client.workPackage.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(saved.workCategoryId).toBe(category.id);
    expect(saved.unitId).toBe(unit.id);
    expect(saved.estimatedCost?.toString()).toBe("200");
    expect(saved.sellingRate?.toString()).toBe("400");
  },
);
it.skipIf(!address)(
  "code conflict rolls back the entire reviewed metadata update",
  async () => {
    await client.accountProduct.create({
      data: { companyId, name: "First", code: "DUPLICATE" },
    });
    const p = await client.accountProduct.create({
      data: { companyId, name: "Original", code: "UNIQUE" },
    });
    await expect(
      editItemMetadata("products", {
        id: p.id,
        expectedUpdatedAt: p.updatedAt.toISOString(),
        name: "Bad",
        code: "DUPLICATE",
      }),
    ).rejects.toThrow();
    expect(
      (await client.accountProduct.findUniqueOrThrow({ where: { id: p.id } }))
        .name,
    ).toBe("Original");
  },
);
