import { Prisma } from "@prisma/client";
import { beforeEach, it, expect, vi } from "vitest";
const calls = vi.hoisted(() => ({
  settings: vi.fn(),
  product: vi.fn(),
  customer: vi.fn(),
  customers: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  current: vi.fn(),
  audit: vi.fn(),
  lock: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
  requirePermission: calls.auth,
  requirePermissionForMutation: calls.auth,
}));
vi.mock("./modules", () => ({ requireAccountModules: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    accountSettings: { findUnique: calls.settings },
    customer: { findMany: calls.customers },
    productPrice: { findMany: calls.list },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: calls.lock,
        $executeRaw: calls.lock,
        accountSettings: { findUnique: calls.settings },
        accountProduct: { findFirst: calls.product },
        customer: { findFirst: calls.customer },
        productPrice: {
          create: calls.create,
          update: calls.update,
          findFirst: calls.current,
        },
        accountOperationalAudit: { create: calls.audit },
      }),
  },
}));
import {
  createProductPriceForActor,
  updateProductPrice,
  listProductPricesForActor,
} from "./inventory";
import type { ProjectActor } from "./projects";
const actor = {
  id: "actor",
  companyId: "00000000-0000-4000-8000-000000000001",
  accountRole: "ACCOUNTANT",
  branchAccessScope: "SELECTED_BRANCHES",
  branchIds: ["branch"],
} as ProjectActor;
const productId = "00000000-0000-4000-8000-000000000002",
  customerId = "00000000-0000-4000-8000-000000000003";
beforeEach(() => {
  vi.clearAllMocks();
  calls.settings.mockResolvedValue({ itemSettings: { enabled: true } });
  calls.product.mockResolvedValue({ id: productId });
  calls.customer.mockResolvedValue({ id: customerId });
  calls.create.mockImplementation(async ({ data }) => ({
    id: "price",
    ...data,
  }));
  calls.update.mockImplementation(async ({ data }) => ({
    id: "price",
    ...data,
  }));
  calls.current.mockResolvedValue({ id: "price" });
  calls.customers.mockResolvedValue([{ id: customerId }]);
  calls.list.mockResolvedValue([]);
  calls.auth.mockResolvedValue(actor);
});
it.each([
  ["WHOLESALE", "wholesalePrice", "WHOLESALE_PRICING_DISABLED"],
  ["CUSTOMER", "partyWiseRate", "CUSTOMER_PRICING_DISABLED"],
])(
  "rejects disabled %s creation and update before writes",
  async (type, key, error) => {
    calls.settings.mockResolvedValue({
      itemSettings: { enabled: true, [key]: false },
    });
    const input = {
      productId,
      priceType: type,
      rate: "10",
      ...(type === "CUSTOMER" ? { customerId } : {}),
    };
    await expect(createProductPriceForActor(actor, input)).rejects.toThrow(
      error,
    );
    await expect(updateProductPrice("price", input)).rejects.toThrow(error);
    expect(calls.create).not.toHaveBeenCalled();
    expect(calls.update).not.toHaveBeenCalled();
    expect(calls.audit).not.toHaveBeenCalled();
  },
);
it("allows enabled wholesale and scoped customer rates and audits each write", async () => {
  await createProductPriceForActor(actor, {
    productId,
    priceType: "WHOLESALE",
    rate: "10.1250",
  });
  await createProductPriceForActor(actor, {
    productId,
    customerId,
    priceType: "CUSTOMER",
    rate: "9",
  });
  expect(calls.create.mock.calls[0][0].data.rate.toString()).toBe("10.13");
  expect(calls.customer).toHaveBeenCalledWith({
    where: {
      id: customerId,
      companyId: actor.companyId,
      isActive: true,
      isAccountCustomer: true,
      branchId: { in: ["branch"] },
    },
  });
  expect(calls.audit).toHaveBeenCalledTimes(2);
});
it("denies foreign/inactive product or inaccessible customer without writes", async () => {
  calls.product.mockResolvedValue(null);
  await expect(
    createProductPriceForActor(actor, {
      productId,
      priceType: "WHOLESALE",
      rate: "10",
    }),
  ).rejects.toThrow();
  calls.product.mockResolvedValue({ id: productId });
  calls.customer.mockResolvedValue(null);
  await expect(
    createProductPriceForActor(actor, {
      productId,
      customerId,
      priceType: "CUSTOMER",
      rate: "10",
    }),
  ).rejects.toThrow();
  expect(calls.create).not.toHaveBeenCalled();
});
it("rejects unauthorized roles, invalid dates and rounding overflow", async () => {
  await expect(
    createProductPriceForActor(
      { ...actor, accountRole: "DATA_ENTRY" },
      { productId, priceType: "RETAIL", rate: "10" },
    ),
  ).rejects.toThrow();
  await expect(
    createProductPriceForActor(actor, {
      productId,
      priceType: "RETAIL",
      rate: "10",
      effectiveFrom: "2026-10-12",
      effectiveTo: "2026-10-01",
    }),
  ).rejects.toThrow("INVALID_PRICE_DATES");
  await expect(
    createProductPriceForActor(actor, {
      productId,
      priceType: "RETAIL",
      rate: "9999999999999999.9999",
    }),
  ).rejects.toThrow("PRICE_VALUE_OUT_OF_RANGE");
  expect(calls.create).not.toHaveBeenCalled();
});

it("price reads hide disabled types and cannot expose another branch customer rate", async () => {
  await listProductPricesForActor(actor, productId);
  expect(calls.customers.mock.calls[0][0].where).toMatchObject({
    companyId: actor.companyId,
    branchId: { in: ["branch"] },
  });
  expect(calls.list.mock.calls[0][0].where.OR).toEqual([
    { priceType: { in: ["RETAIL", "WHOLESALE"] }, customerId: null },
    { priceType: "CUSTOMER", customerId: { in: [customerId] } },
  ]);
  calls.settings.mockResolvedValue({
    itemSettings: {
      enabled: true,
      wholesalePrice: false,
      partyWiseRate: false,
    },
  });
  calls.customers.mockClear();
  await listProductPricesForActor(actor, productId);
  expect(calls.customers).not.toHaveBeenCalled();
  expect(calls.list.mock.calls[1][0].where.OR).toEqual([
    { priceType: { in: ["RETAIL"] }, customerId: null },
  ]);
});

it("changing customer pricing to wholesale clears stale customer/dates and audits both rate snapshots", async () => {
  calls.current.mockResolvedValue({
    id: "price",
    productId,
    priceType: "CUSTOMER",
    customerId,
    rate: new Prisma.Decimal("9"),
    effectiveFrom: new Date("2026-10-01"),
    effectiveTo: new Date("2026-10-12"),
  });
  await updateProductPrice("price", {
    productId,
    priceType: "WHOLESALE",
    rate: "10",
  });
  expect(calls.update.mock.calls[0][0].data).toMatchObject({
    customerId: null,
    effectiveFrom: null,
    effectiveTo: null,
  });
  expect(calls.audit.mock.calls[0][0].data.metadata).toMatchObject({
    before: { priceType: "CUSTOMER", rate: "9", customerId },
    after: { priceType: "WHOLESALE", rate: "10", customerId: null },
  });
});
it("cannot take over another branch customer rate by changing its type", async () => {
  calls.current.mockResolvedValue({ id: "price", customerId });
  calls.customer.mockResolvedValue(null);
  await expect(
    updateProductPrice("price", {
      productId,
      priceType: "WHOLESALE",
      rate: "10",
    }),
  ).rejects.toThrow();
  expect(calls.update).not.toHaveBeenCalled();
  expect(calls.audit).not.toHaveBeenCalled();
});
