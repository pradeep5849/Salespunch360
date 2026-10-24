import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  transaction: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {
    constructor() {
      super("NOT_AUTHORIZED");
    }
  },
  requirePermission: mocks.permission,
  requirePermissionForMutation: mocks.permission,
}));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("./inventory", () => ({
  assertInventoryAvailable: vi.fn().mockResolvedValue(undefined),
}));
import { setItemsActive } from "./service";
const company = "00000000-0000-4000-8000-000000000001",
  one = "00000000-0000-4000-8000-000000000002",
  two = "00000000-0000-4000-8000-000000000003";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue({ companyId: company });
  mocks.transaction.mockImplementation(async (callback) =>
    callback({
      accountProduct: { count: mocks.count, updateMany: mocks.update },
      accountService: { count: mocks.count, updateMany: mocks.update },
    }),
  );
  mocks.count.mockResolvedValue(2);
  mocks.update.mockResolvedValue({ count: 2 });
});
describe("A055 bulk activation tenant boundary", () => {
  it.each(["products", "services"] as const)(
    "changes every selected %s under one company predicate",
    async (kind) => {
      expect(await setItemsActive(kind, [one, two, one], false)).toEqual({
        count: 2,
      });
      expect(mocks.count).toHaveBeenCalledWith({
        where: { companyId: company, id: { in: [one, two] } },
      });
      expect(mocks.update).toHaveBeenCalledWith({
        where: { companyId: company, id: { in: [one, two] } },
        data: { isActive: false },
      });
    },
  );
  it.each([0, 1])(
    "rejects %i matching IDs before any write instead of reporting partial success",
    async (count) => {
      mocks.count.mockResolvedValue(count);
      await expect(
        setItemsActive("products", [one, two], true),
      ).rejects.toThrow("NOT_AUTHORIZED");
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
  it("rolls back if the affected count changes during the update", async () => {
    mocks.update.mockResolvedValue({ count: 1 });
    await expect(setItemsActive("products", [one, two], true)).rejects.toThrow(
      "NOT_AUTHORIZED",
    );
  });
  it("rejects missing permission before opening a transaction", async () => {
    mocks.permission.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(setItemsActive("products", [one], true)).rejects.toThrow(
      "FORBIDDEN",
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects an invalid ID and treats an empty selection as no change", async () => {
    await expect(
      setItemsActive("products", ["invalid"], true),
    ).rejects.toThrow();
    expect(await setItemsActive("services", [], false)).toEqual({ count: 0 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
