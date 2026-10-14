import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/lib/auth/authorization";
import { z } from "zod";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), money: vi.fn() }));
vi.mock("@/lib/mobile/auth", () => ({ authenticateMobileToken: mocks.auth }));
vi.mock("@/lib/mobile/account-administration", () => ({
  mobileNotifications: mocks.money,
}));
import { GET } from "./route";
describe("mobile notification scope and privacy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ id: "actor" });
    mocks.money.mockResolvedValue({
      rows: [],
      expenseTotal: 0,
      hasMoreExpenses: false,
    });
  });
  it("authenticates and forwards branch/company context", async () => {
    const response = await GET(
      new Request("https://app.invalid/api?branchId=branch", {
        headers: { authorization: "Bearer test" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.auth).toHaveBeenCalledWith("Bearer test");
    expect(mocks.money).toHaveBeenCalledWith(
      { id: "actor" },
      { branchId: "branch" },
    );
  });
  it("returns controlled auth, scope denial and malformed-input responses", async () => {
    const request = new Request("https://app.invalid/api");
    mocks.auth.mockRejectedValueOnce(new Error("MOBILE_UNAUTHORIZED"));
    expect((await GET(request)).status).toBe(401);
    expect(mocks.money).not.toHaveBeenCalled();
    mocks.money.mockRejectedValueOnce(new AuthorizationError());
    expect((await GET(request)).status).toBe(403);
    mocks.money.mockRejectedValueOnce(
      z.string().uuid().safeParse("invalid").error,
    );
    expect((await GET(request)).status).toBe(400);
  });
  it("keeps financial context out of shared caches", async () => {
    const response = await GET(
      new Request("https://app.invalid/api?scope=all"),
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.money).toHaveBeenCalledWith({ id: "actor" }, { scope: "all" });
  });
});
