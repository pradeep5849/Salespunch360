import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  find: vi.fn(),
  upsert: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
  requirePermission: vi.fn(),
  requirePermissionForMutation: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { $transaction: m.transaction } }));
import { updateItemSettingsForActor } from "./settings";
import { resolveItemSettings } from "./item-settings-policy";
const actor = {
  id: "admin",
  companyId: "tenant",
  accountRole: "ACCOUNT_ADMIN",
};
describe("A057 shared item settings writes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.find.mockResolvedValue({
      itemSettings: {
        unitConversions: [{ rate: "12" }],
        barcodeScanning: false,
      },
    });
    m.transaction.mockImplementation((fn) =>
      fn({
        accountSettings: { findUnique: m.find, upsert: m.upsert },
        accountingAuditEvent: { create: m.audit },
        $executeRaw: m.lock,
      }),
    );
    m.upsert.mockResolvedValue({});
    m.audit.mockResolvedValue({});
  });
  it("preserves conversion metadata and records before/after in the same transaction", async () => {
    await updateItemSettingsForActor(actor, resolveItemSettings(null));
    expect(m.find).toHaveBeenCalledWith({
      where: { companyId: "tenant" },
      select: { itemSettings: true },
    });
    expect(m.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "tenant" },
        update: {
          itemSettings: expect.objectContaining({
            unitConversions: [{ rate: "12" }],
            barcodeScanning: false,
            taxOnMrp: false,
            updateSalePrice: false,
          }),
        },
      }),
    );
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "tenant",
          actorUserId: "admin",
          metadata: expect.objectContaining({
            before: {
              unitConversions: [{ rate: "12" }],
              barcodeScanning: false,
            },
            after: expect.objectContaining({
              unitConversions: [{ rate: "12" }],
              taxOnMrp: false,
            }),
          }),
        }),
      }),
    );
    expect(m.transaction).toHaveBeenCalledTimes(1);
  });
  it("denies a default unit when item units are disabled before any write", async () => {
    await expect(
      updateItemSettingsForActor(actor, {
        ...resolveItemSettings(null),
        itemUnits: false,
        defaultUnit: "PCS",
      }),
    ).rejects.toThrow("DEFAULT_UNIT_REQUIRES_ITEM_UNITS");
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("denies non-admin settings mutation", async () => {
    await expect(
      updateItemSettingsForActor(
        { ...actor, accountRole: "ACCOUNTANT" },
        resolveItemSettings(null),
      ),
    ).rejects.toThrow();
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("propagates audit failure through the transaction", async () => {
    m.audit.mockRejectedValue(new Error("audit unavailable"));
    await expect(
      updateItemSettingsForActor(actor, resolveItemSettings(null)),
    ).rejects.toThrow("audit unavailable");
  });
});
