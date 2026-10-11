import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  settings: vi.fn(),
  permission: vi.fn(),
  module: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    accountSettings: { findUnique: mocks.settings },
  },
}));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
  requirePermission: mocks.permission,
  requirePermissionForMutation: mocks.permission,
}));
vi.mock("@/lib/account/modules", () => ({
  requireAccountModules: mocks.module,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import {
  createStockMovementForActor,
  transferStockForActor,
  createBatchForActor,
  registerSerialNumberForActor,
  createProductPriceForActor,
  inventoryOptionsForActor,
} from "./inventory";
import { adjustmentAction } from "@/app/actions/inventory";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue({
    companyId: "00000000-0000-4000-8000-000000000001",
    accountRole: "ACCOUNT_ADMIN",
  });
  mocks.module.mockResolvedValue(undefined);
  mocks.settings.mockResolvedValue({ itemSettings: { enabled: true } });
  mocks.transaction.mockResolvedValue({ id: "movement" });
});
describe("A054 adjustment action input", () => {
  it.each(["IN", "OUT"])(
    "accepts a %s adjustment submitted by a React server action",
    async (direction) => {
      const form = new FormData();
      for (const [key, value] of Object.entries({
        direction,
        warehouseId: "00000000-0000-4000-8000-000000000002",
        productId: "00000000-0000-4000-8000-000000000003",
        quantity: "2",
        unitCost: "3",
        movementDate: "2026-10-09",
        reason: "Stock count correction",
        $ACTION_ID_reference: "",
        "$ACTION_0:0": "React action payload",
      }))
        form.set(key, value);
      await adjustmentAction(form);
      // The real strict movement validator executes before this transaction.
      expect(mocks.transaction).toHaveBeenCalledOnce();
      expect(mocks.revalidate).toHaveBeenCalledWith(
        "/workspace/account/inventory/stock",
      );
    },
  );
  it("rejects unsupported directions before any transaction", async () => {
    const form = new FormData();
    form.set("direction", "SIDEWAYS");
    await expect(adjustmentAction(form)).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("A054 Items OFF service boundary", () => {
  it.each([
    createStockMovementForActor,
    transferStockForActor,
    createBatchForActor,
    registerSerialNumberForActor,
    createProductPriceForActor,
    inventoryOptionsForActor,
  ])(
    "blocks the inventory operation before a read/write transaction",
    async (operation) => {
      mocks.settings.mockResolvedValue({ itemSettings: { enabled: false } });
      const actor = {
        companyId: "00000000-0000-4000-8000-000000000001",
      };
      await expect(
        (operation as (...args: unknown[]) => Promise<unknown>)(
          actor,
          "ADJUSTMENT_IN",
          {},
        ),
      ).rejects.toThrow("ITEMS_DISABLED");
      expect(mocks.settings).toHaveBeenCalledWith({
        where: { companyId: actor.companyId },
        select: { itemSettings: true },
      });
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );
});
