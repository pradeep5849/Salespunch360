import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), home: vi.fn(), findUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthenticatedUser: m.user }));
vi.mock("@/lib/auth/routing", () => ({ authenticatedHome: m.home }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: m.findUser } } }));
import { GET } from "./route";
beforeEach(() => { vi.resetAllMocks(); delete process.env.FIRST_USE_PHONE_VERIFICATION_ENABLED; });
it("confirms only existing authenticated sessions without disclosing user details", async () => {
  m.user.mockResolvedValue({ id: "private-id", email: "private@example.test" });
  m.home.mockReturnValue("/workspace/account");
  const r = await GET();
  expect(await r.json()).toEqual({
    authenticated: true,
    redirectTo: "/workspace/account",
  });
  expect(r.headers.get("Cache-Control")).toContain("no-store");
});
it("does not assume authentication when absent", async () => {
  m.user.mockResolvedValue(null);
  expect(await (await GET()).json()).toEqual({ authenticated: false });
  expect(m.home).not.toHaveBeenCalled();
});
it("returns a recoverable unavailable response without exposing database errors", async () => {
  m.user.mockRejectedValue(new Error("private database password"));
  const r = await GET();
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("password");
});

it("routes an unverified employee to OTP after interrupted sign-in", async () => {
  process.env.FIRST_USE_PHONE_VERIFICATION_ENABLED = "true";
  m.user.mockResolvedValue({ id: "employee-1", companyId: "company-1", role: "EMPLOYEE" });
  m.findUser.mockResolvedValue({ role: "EMPLOYEE", companyId: "company-1", phone: "+919876543210", phoneVerifiedAt: null });
  m.home.mockReturnValue("/workspace");
  expect(await (await GET()).json()).toEqual({ authenticated: true, redirectTo: "/verify-mobile" });
  expect(m.home).not.toHaveBeenCalled();
});
it("allows a verified employee to recover their workspace session", async () => {
  process.env.FIRST_USE_PHONE_VERIFICATION_ENABLED = "true";
  m.user.mockResolvedValue({ id: "employee-1", companyId: "company-1", role: "EMPLOYEE" });
  m.findUser.mockResolvedValue({ role: "EMPLOYEE", companyId: "company-1", phone: "+919876543210", phoneVerifiedAt: new Date() });
  m.home.mockReturnValue("/workspace");
  expect(await (await GET()).json()).toEqual({ authenticated: true, redirectTo: "/workspace" });
});
it("fails closed if employee verification state is unavailable", async () => {
  process.env.FIRST_USE_PHONE_VERIFICATION_ENABLED = "true";
  m.user.mockResolvedValue({ id: "employee-1", companyId: "company-1", role: "EMPLOYEE" });
  m.findUser.mockResolvedValue(null);
  const r = await GET();
  expect(r.status).toBe(503);
  expect(m.home).not.toHaveBeenCalled();
});
