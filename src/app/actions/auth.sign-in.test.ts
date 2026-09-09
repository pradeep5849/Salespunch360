import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), verify: vi.fn(), session: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.find } } }));
vi.mock("@/lib/auth/session", () => ({ createSession: mocks.session, revokeCurrentSession: vi.fn() }));
vi.mock("@/lib/auth/crypto", () => ({ verifyPassword: mocks.verify, hashPassword: vi.fn() }));
vi.mock("@/lib/auth/session-generation", () => ({ replacePasswordAndRevoke: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/security/request", () => ({ assertTrustedOrigin: vi.fn(), consumeRateLimit: vi.fn(async () => true), requestFingerprint: vi.fn(async () => "key") }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { signIn } from "./auth";

function data() { const form = new FormData(); form.set("email", "admin@example.com"); form.set("password", "ValidPassword!1"); return form; }
function user(role = "COMPANY_ADMIN", companyId: string | null = "company", isActive = true) { return { id: "user", role, companyId, isActive, passwordHash: "hash" }; }
beforeEach(() => { vi.clearAllMocks(); mocks.find.mockResolvedValue(user()); mocks.verify.mockResolvedValue(true); });
describe("authoritative sign-in destination", () => {
  it("creates a global Super Admin session and redirects to /admin", async () => { mocks.find.mockResolvedValue(user("SUPER_ADMIN", null)); await signIn({}, data()); expect(mocks.session).toHaveBeenCalledWith("user", false, "hash"); expect(mocks.redirect).toHaveBeenCalledWith("/admin"); });
  it("continues to route a tenant user to /workspace", async () => { await signIn({}, data()); expect(mocks.redirect).toHaveBeenCalledWith("/workspace"); });
  it("fails a tenant-attached SUPER_ADMIN closed without a session", async () => { mocks.find.mockResolvedValue(user("SUPER_ADMIN", "company")); await expect(signIn({}, data())).resolves.toEqual({ error: "Invalid email or password." }); expect(mocks.session).not.toHaveBeenCalled(); expect(mocks.redirect).not.toHaveBeenCalled(); });
  it("keeps a wrong password generic", async () => { mocks.verify.mockResolvedValue(false); await expect(signIn({}, data())).resolves.toEqual({ error: "Invalid email or password." }); expect(mocks.session).not.toHaveBeenCalled(); });
  it("keeps inactive-user behavior generic", async () => { mocks.find.mockResolvedValue(user("COMPANY_ADMIN", "company", false)); await expect(signIn({}, data())).resolves.toEqual({ error: "Invalid email or password." }); expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.session).not.toHaveBeenCalled(); });
});
