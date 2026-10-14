import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
const url = process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if (
  url &&
  (!["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error("Isolated local *_ci database required");
const client = new PrismaClient({
  datasources: {
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/checkpoint_ci" },
  },
});
const companyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  warehouseId = randomUUID();
const actor = {
  id: userId,
  companyId,
  name: "Opening actor",
  email: `${userId}@example.test`,
  role: "ACCOUNT_USER" as const,
  accountRole: "ACCOUNT_ADMIN" as const,
  isActive: true,
  accountAccessActive: true,
  salesAccessActive: false,
  managerType: null,
  salesRole: null,
  salesAccessActiveUntil: null,
  branchAccessScope: "ALL_BRANCHES" as const,
  branchIds: [],
};
let currentActor: object = actor,
  failAudit = false;
let failPriceAudit = false;
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
  requirePermission: vi.fn(async () => currentActor),
  requirePermissionForMutation: vi.fn(async () => currentActor),
}));
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === "$transaction")
          return (
            fn: (tx: Prisma.TransactionClient) => unknown,
            options: object,
          ) =>
            client.$transaction(
              async (tx) =>
                fn(
                  new Proxy(tx, {
                    get: (target, name) => {
                      if (name === "accountOperationalAudit")
                        return new Proxy(target.accountOperationalAudit, {
                          get: (delegate, method) =>
                            method === "create"
                              ? async (
                                  args: Parameters<typeof delegate.create>[0],
                                ) => {
                                  if (
                                    (failAudit &&
                                      args.data.eventType ===
                                        "STOCK_OPENING") ||
                                    (failPriceAudit &&
                                      args.data.eventType ===
                                        "PRODUCT_PRICE_CREATED")
                                  )
                                    throw new Error(
                                      failPriceAudit
                                        ? "PRICE_AUDIT_FAILURE"
                                        : "OPENING_AUDIT_FAILURE",
                                    );
                                  return delegate.create(args);
                                }
                              : delegate[method as keyof typeof delegate],
                        });
                      return target[name as keyof typeof target];
                    },
                  }),
                ),
              options,
            );
        const value = (client as unknown as Record<PropertyKey, unknown>)[key];
        return typeof value === "function" ? value.bind(client) : value;
      },
    },
  ),
}));
import { createProduct } from "./service";
import { createProductPriceForActor } from "./inventory";
const input = (key = randomUUID(), quantity = "2.1250") => ({
  name: `Opening ${key}`,
  code: `P-${key}`,
  sellingRate: "10",
  cost: "20",
  taxRate: "0",
  trackInventory: true,
  creationRequestKey: key,
  itemLocation: "Shelf one",
  openingStock: {
    warehouseId,
    quantity,
    unitCost: "3.3333",
    movementDate: "2026-10-12",
  },
});
describe.skipIf(!url)("A058 atomic item opening stock", () => {
  beforeAll(async () => {
    await client.company.create({
      data: {
        id: companyId,
        name: "Opening fixture",
        slug: `opening-${companyId}`,
        productEdition: "SALESPUNCH360_ACCOUNT",
      },
    });
    await client.branch.create({
      data: { id: branchId, companyId, name: "Main", code: "MAIN" },
    });
    await client.user.create({
      data: {
        id: userId,
        companyId,
        name: actor.name,
        email: actor.email,
        passwordHash: "test-only-not-for-login",
        role: "ACCOUNT_USER",
        accountRole: "ACCOUNT_ADMIN",
        accountAccessActive: true,
      },
    });
    await client.accountSettings.create({
      data: {
        companyId,
        itemSettings: { enabled: true, stockMaintenance: true },
      },
    });
    await client.warehouse.create({
      data: {
        id: warehouseId,
        companyId,
        branchId,
        name: "Opening warehouse",
        code: "OPEN",
      },
    });
  });
  beforeEach(() => {
    currentActor = actor;
    failAudit = false;
    failPriceAudit = false;
  });
  afterAll(async () => {
    if (url)
      await client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
        await tx.stockMovement.deleteMany({ where: { companyId } });
        await tx.customFieldValue.deleteMany({ where: { companyId } });
        await tx.accountOperationalAudit.deleteMany({ where: { companyId } });
        await tx.productPrice.deleteMany({ where: { companyId } });
        await tx.accountProduct.deleteMany({ where: { companyId } });
        await tx.warehouse.deleteMany({ where: { companyId } });
        await tx.accountSettings.deleteMany({ where: { companyId } });
        await tx.user.deleteMany({ where: { companyId } });
        await tx.branch.deleteMany({ where: { companyId } });
        await tx.company.delete({ where: { id: companyId } });
      });
    await client.$disconnect();
  });
  it("saves independent purchase cost, location and exact opening valuation together", async () => {
    const row = await createProduct(input());
    expect(row.costPrice?.toString()).toBe("20");
    expect(row.itemLocation).toBe("Shelf one");
    const opening = await client.stockMovement.findFirstOrThrow({
      where: { companyId, productId: row.id },
    });
    expect(opening.quantity.toString()).toBe("2.125");
    expect(opening.unitCost.toString()).toBe("3.3333");
    expect(opening.totalCost.toString()).toBe("7.08");
    expect(opening.branchId).toBe(branchId);
  });
  it("concurrent retry creates one item, opening and audit, and changed payload is rejected", async () => {
    const raw = input();
    const [first, second] = await Promise.all([
      createProduct(raw),
      createProduct(raw),
    ]);
    expect(first.id).toBe(second.id);
    expect(
      await client.accountProduct.count({
        where: { companyId, creationRequestKey: raw.creationRequestKey },
      }),
    ).toBe(1);
    expect(
      await client.stockMovement.count({
        where: { companyId, productId: first.id },
      }),
    ).toBe(1);
    const movement = await client.stockMovement.findFirstOrThrow({
      where: { companyId, productId: first.id },
    });
    expect(
      await client.accountOperationalAudit.count({
        where: { companyId, eventType: "STOCK_OPENING", entityId: movement.id },
      }),
    ).toBe(1);
    await expect(
      createProduct({
        ...raw,
        openingStock: { ...raw.openingStock, quantity: "3" },
      }),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("opening audit failure rolls back both item and movement", async () => {
    const raw = input();
    failAudit = true;
    try {
      await expect(createProduct(raw)).rejects.toThrow("OPENING_AUDIT_FAILURE");
    } finally {
      failAudit = false;
    }
    expect(
      await client.accountProduct.count({
        where: { companyId, creationRequestKey: raw.creationRequestKey },
      }),
    ).toBe(0);
    expect(
      await client.stockMovement.count({
        where: { companyId, sourceId: raw.creationRequestKey },
      }),
    ).toBe(0);
  });
  it("denies foreign/missing warehouse and empty assigned branch scope before creating an item", async () => {
    const raw = input();
    await expect(
      createProduct({
        ...raw,
        openingStock: { ...raw.openingStock, warehouseId: randomUUID() },
      }),
    ).rejects.toThrow();
    currentActor = {
      ...actor,
      branchAccessScope: "SELECTED_BRANCHES",
      branchIds: [],
    };
    await expect(createProduct(raw)).rejects.toThrow();
    expect(
      await client.accountProduct.count({
        where: { companyId, creationRequestKey: raw.creationRequestKey },
      }),
    ).toBe(0);
  });
  it("a retry cannot disclose an opening after branch access is removed", async () => {
    const raw = input();
    await createProduct(raw);
    currentActor = {
      ...actor,
      branchAccessScope: "SELECTED_BRANCHES",
      branchIds: [],
    };
    await expect(createProduct(raw)).rejects.toThrow();
  });
  it("zero opening creates the item without a stock entry", async () => {
    const raw = input(randomUUID(), "0");
    const row = await createProduct(raw);
    expect(
      await client.stockMovement.count({
        where: { companyId, productId: row.id },
      }),
    ).toBe(0);
  });
  it("disabled price switches block direct writes and enabled rates are audited", async () => {
    const product = await createProduct({
      name: "Price policy item",
      code: `PRICE-${randomUUID()}`,
    });
    await client.accountSettings.update({
      where: { companyId },
      data: {
        itemSettings: {
          enabled: true,
          wholesalePrice: false,
          partyWiseRate: false,
        },
      },
    });
    await expect(
      createProductPriceForActor(actor, {
        productId: product.id,
        priceType: "WHOLESALE",
        rate: "10",
      }),
    ).rejects.toThrow("WHOLESALE_PRICING_DISABLED");
    await expect(
      createProductPriceForActor(actor, {
        productId: product.id,
        customerId: randomUUID(),
        priceType: "CUSTOMER",
        rate: "10",
      }),
    ).rejects.toThrow("CUSTOMER_PRICING_DISABLED");
    expect(
      await client.productPrice.count({
        where: { companyId, productId: product.id },
      }),
    ).toBe(0);
    await client.accountSettings.update({
      where: { companyId },
      data: {
        itemSettings: {
          enabled: true,
          wholesalePrice: true,
          partyWiseRate: true,
        },
      },
    });
    const price = await createProductPriceForActor(actor, {
      productId: product.id,
      priceType: "WHOLESALE",
      rate: "10.1250",
    });
    expect(price.rate.toString()).toBe("10.13");
    expect(
      await client.accountOperationalAudit.count({
        where: {
          companyId,
          entityId: price.id,
          eventType: "PRODUCT_PRICE_CREATED",
        },
      }),
    ).toBe(1);
  });
  it("price audit failure rolls back the price record", async () => {
    const product = await createProduct({
      name: "Price rollback item",
      code: `PRICE-${randomUUID()}`,
    });
    failPriceAudit = true;
    try {
      await expect(
        createProductPriceForActor(actor, {
          productId: product.id,
          priceType: "WHOLESALE",
          rate: "10",
        }),
      ).rejects.toThrow("PRICE_AUDIT_FAILURE");
    } finally {
      failPriceAudit = false;
    }
    expect(
      await client.productPrice.count({
        where: { companyId, productId: product.id },
      }),
    ).toBe(0);
  });
});
