import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock("./session", () => ({ getAuthenticatedUser: auth.user }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
import { requireGlobalSuperAdmin, requireGlobalSuperAdminForMutation } from "./authorization";

const globalAdmin = { role: "SUPER_ADMIN", companyId: null };
beforeEach(() => { vi.clearAllMocks(); auth.user.mockResolvedValue(globalAdmin); });
describe("global Super Admin authorization", () => {
  it("allows only SUPER_ADMIN without a Company", async () => {
    await expect(requireGlobalSuperAdmin()).resolves.toMatchObject(globalAdmin);
    await expect(requireGlobalSuperAdminForMutation()).resolves.toMatchObject(globalAdmin);
  });
  it.each([
    ["SUPER_ADMIN", "11111111-1111-4111-8111-111111111111"], ["COMPANY_ADMIN", "company"],
    ["FIELD_ADMIN", "company"], ["MANAGER", "company"], ["SALES", "company"], ["ACCOUNT_USER", "company"],
  ])("denies %s attached to %s", async (role, companyId) => {
    auth.user.mockResolvedValue({ role, companyId });
    await expect(requireGlobalSuperAdmin()).rejects.toThrow("Not authorized");
    await expect(requireGlobalSuperAdminForMutation()).rejects.toThrow("Not authorized");
  });
});
