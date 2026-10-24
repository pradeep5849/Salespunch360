import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  available: vi.fn(),
  lock: vi.fn(),
  find: vi.fn(),
  save: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { $transaction: m.transaction } }));
vi.mock("./inventory", () => ({ assertInventoryAvailable: m.available }));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
}));
import { updateQuickItemSettingForActor } from "./item-settings-quick";
const admin = {
  id: "actor-a",
  companyId: "company-a",
  accountRole: "ACCOUNT_ADMIN",
};
describe("single item setting saves", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.find.mockResolvedValue({
      itemSettings: {
        description: true,
        quantityDecimals: 4,
        unitConversions: [{ rate: "12" }],
      },
    });
    m.transaction.mockImplementation((fn) =>
      fn({
        $executeRaw: m.lock,
        accountSettings: { findUnique: m.find, upsert: m.save },
        accountingAuditEvent: { create: m.audit },
      }),
    );
  });
  it.each([
    "customFields",
    "additionalFields",
    "wholesalePrice",
    "barcodeScanning",
    "itemCategory",
    "description",
  ])("saves %s without discarding unrelated settings", async (key) => {
    const result = await updateQuickItemSettingForActor(admin, {
      key,
      value: false,
    });
    expect(result).toMatchObject({ [key]: false, quantityDecimals: 4 });
    expect(m.find).toHaveBeenCalledWith({
      where: { companyId: "company-a" },
      select: { itemSettings: true },
    });
    expect(m.lock).toHaveBeenCalledOnce();
    expect(m.save).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "company-a" },
        update: {
          itemSettings: expect.objectContaining({
            [key]: false,
            quantityDecimals: 4,
            unitConversions: [{ rate: "12" }],
          }),
        },
      }),
    );
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "actor-a",
          companyId: "company-a",
          metadata: expect.objectContaining({ changedKey: key }),
        }),
      }),
    );
  });
  it("rejects non-admin before database access", async () => {
    await expect(
      updateQuickItemSettingForActor(
        { ...admin, accountRole: "ACCOUNTANT" },
        { key: "description", value: false },
      ),
    ).rejects.toThrow();
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("rejects unsupported keys and extra fields", async () => {
    for (const raw of [
      { key: "enabled", value: false },
      { key: "description", value: false, companyId: "foreign" },
    ])
      await expect(
        updateQuickItemSettingForActor(admin, raw),
      ).rejects.toThrow();
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("rechecks Items OFF under the lock before saving", async () => {
    m.find.mockResolvedValue({ itemSettings: { enabled: false } });
    await expect(
      updateQuickItemSettingForActor(admin, {
        key: "description",
        value: false,
      }),
    ).rejects.toThrow("ITEMS_DISABLED");
    expect(m.save).not.toHaveBeenCalled();
  });
  it("honors module and Items OFF denial", async () => {
    m.available.mockRejectedValue(new Error("ITEMS_DISABLED"));
    await expect(
      updateQuickItemSettingForActor(admin, {
        key: "description",
        value: false,
      }),
    ).rejects.toThrow("ITEMS_DISABLED");
    expect(m.transaction).not.toHaveBeenCalled();
  });
});
