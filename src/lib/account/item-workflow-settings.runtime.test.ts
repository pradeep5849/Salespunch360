import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  permission: vi.fn(),
  modules: vi.fn(),
  find: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({
  requirePermission: m.permission,
}));
vi.mock("./modules", () => ({ requireAccountModules: m.modules }));
vi.mock("@/lib/db", () => ({
  db: { accountSettings: { findUnique: m.find } },
}));
import { getItemWorkflowSettings } from "./item-workflow-settings";
describe("A058 operational item settings reader", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.permission.mockResolvedValue({
      companyId: "company-a",
      accountRole: "ACCOUNTANT",
    });
    m.find.mockResolvedValue({ itemSettings: { quantityDecimals: 4 } });
  });
  it("allows the authorized Accountant through stock permission and returns only scoped operational settings", async () => {
    const result = await getItemWorkflowSettings();
    expect(m.permission).toHaveBeenCalledWith("ACCOUNT_STOCK");
    expect(m.modules).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "company-a" }),
      "INVENTORY",
    );
    expect(m.find).toHaveBeenCalledWith({
      where: { companyId: "company-a" },
      select: { itemSettings: true },
    });
    expect(result).toMatchObject({
      companyId: "company-a",
      itemSettings: { quantityDecimals: 4 },
    });
    expect(Object.keys(result).sort()).toEqual([
      "canManageItemSettings",
      "companyId",
      "itemSettings",
    ]);
  });
  it("does not query settings after permission denial", async () => {
    m.permission.mockRejectedValue(new Error("denied"));
    await expect(getItemWorkflowSettings()).rejects.toThrow("denied");
    expect(m.find).not.toHaveBeenCalled();
  });
  it("does not query settings when Inventory is disabled", async () => {
    m.modules.mockRejectedValue(new Error("ACCOUNT_MODULE_DISABLED:INVENTORY"));
    await expect(getItemWorkflowSettings()).rejects.toThrow(
      "ACCOUNT_MODULE_DISABLED",
    );
    expect(m.find).not.toHaveBeenCalled();
  });
  it("honors Items OFF while using documented defaults for an absent settings row", async () => {
    m.find.mockResolvedValue({ itemSettings: { enabled: false } });
    await expect(getItemWorkflowSettings()).rejects.toThrow("ITEMS_DISABLED");
    m.find.mockResolvedValue(null);
    expect((await getItemWorkflowSettings()).itemSettings).toMatchObject({
      enabled: true,
      taxOnMrp: false,
      quantityDecimals: 2,
    });
  });
});
