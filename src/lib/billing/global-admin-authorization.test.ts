import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), mutation: vi.fn(), transaction: vi.fn(), companyFind: vi.fn(), priceFind: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireGlobalSuperAdmin: mocks.read, requireGlobalSuperAdminForMutation: mocks.mutation, requirePermission: vi.fn(), requirePermissionForMutation: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction, company: { findMany: mocks.companyFind }, billingPrice: { findMany: mocks.priceFind } } }));
vi.mock("./seat-reduction", () => ({ applyDueSeatReductions: vi.fn() }));
import { changePrice, manualOverride, platformBilling } from "./service";
const denied = new Error("Not authorized");
beforeEach(() => { vi.clearAllMocks(); mocks.read.mockRejectedValue(denied); mocks.mutation.mockRejectedValue(denied); });
describe("platform billing global authorization boundary", () => {
  it("denies platformBilling before reading prices or Companies", async () => { await expect(platformBilling()).rejects.toThrow("Not authorized"); expect(mocks.priceFind).not.toHaveBeenCalled(); expect(mocks.companyFind).not.toHaveBeenCalled(); });
  it("denies changePrice before validation or a transaction", async () => { await expect(changePrice({})).rejects.toThrow("Not authorized"); expect(mocks.transaction).not.toHaveBeenCalled(); });
  it("denies manualOverride before validation or a transaction", async () => { await expect(manualOverride({})).rejects.toThrow("Not authorized"); expect(mocks.transaction).not.toHaveBeenCalled(); });
});
