import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), home: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthenticatedUser: m.user }));
vi.mock("@/lib/auth/routing", () => ({ authenticatedHome: m.home }));
import { GET } from "./route";
beforeEach(() => vi.resetAllMocks());
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
