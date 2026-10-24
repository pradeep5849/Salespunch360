import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  products: vi.fn(),
  services: vi.fn(),
  stock: vi.fn(),
  log: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
  requirePermission: mocks.permission,
}));
vi.mock("@/lib/db", () => ({
  db: {
    accountProduct: { findMany: mocks.products },
    accountService: { findMany: mocks.services },
  },
}));
vi.mock("@/lib/account/inventory", () => ({ inventorySnapshot: mocks.stock }));
vi.mock("@/lib/logging", () => ({ logEvent: mocks.log }));
vi.mock("@/components/account/active-items-manager", () => ({
  ActiveItemsManager: () => null,
}));
import Page from "@/app/workspace/account/inventory/active/page";
import { AuthorizationError } from "@/lib/auth/authorization";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue({ companyId: "company" });
  mocks.products.mockResolvedValue([
    { id: "product", name: "Item", code: null },
  ]);
  mocks.services.mockResolvedValue([]);
  mocks.stock.mockResolvedValue([]);
});
describe("A055 stock-read recovery", () => {
  it("shows unknown quantities when the stock service fails while retaining the item list", async () => {
    mocks.stock.mockRejectedValue(new Error("connection interrupted"));
    const page = await Page({ searchParams: Promise.resolve({}) });
    expect(page.props.stockUnavailable).toBe(true);
    expect(page.props.products).toEqual([
      { id: "product", name: "Item", code: null, stock: null },
    ]);
    expect(mocks.log).toHaveBeenCalledOnce();
  });
  it.each([new AuthorizationError(), new Error("ITEMS_DISABLED")])(
    "does not turn permission or Items OFF denial into a usable inventory page",
    async (error) => {
      mocks.stock.mockRejectedValue(error);
      await expect(
        Page({ searchParams: Promise.resolve({}) }),
      ).rejects.toThrow();
      expect(mocks.log).not.toHaveBeenCalled();
    },
  );
  it("keeps successful empty stock distinct from a failed stock load", async () => {
    const page = await Page({ searchParams: Promise.resolve({}) });
    expect(page.props.stockUnavailable).toBe(false);
    expect(page.props.products[0].stock).toBe(0);
  });
});
