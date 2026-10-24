import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/lib/auth/authorization";
import { z } from "zod";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), money: vi.fn() }));
vi.mock("@/lib/mobile/auth", () => ({ authenticateMobileToken: mocks.auth }));
vi.mock("@/lib/mobile/account-money", () => ({
  mobileLoanHistory: mocks.money,
}));
import { GET } from "./route";
describe("mobile loan history read scope", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ id: "actor" });
    mocks.money.mockResolvedValue({ dashboard: { accounts: [] } });
  });
  it("authenticates and forwards branch/company context", async () => {
    const response = await GET(
      new Request("https://app.invalid/api?branchId=branch", {
        headers: { authorization: "Bearer test" },
      }),
      { params: Promise.resolve({ id: "account" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.auth).toHaveBeenCalledWith("Bearer test");
    expect(mocks.money).toHaveBeenCalledWith({ id: "actor" }, "account", {
      branchId: "branch",
    });
  });
  it("returns controlled auth, scope denial and malformed-input responses", async () => {
    const request = new Request("https://app.invalid/api");
    mocks.auth.mockRejectedValueOnce(new Error("MOBILE_UNAUTHORIZED"));
    expect(
      (await GET(request, { params: Promise.resolve({ id: "account" }) }))
        .status,
    ).toBe(401);
    expect(mocks.money).not.toHaveBeenCalled();
    mocks.money.mockRejectedValueOnce(new AuthorizationError());
    expect(
      (await GET(request, { params: Promise.resolve({ id: "account" }) }))
        .status,
    ).toBe(403);
    mocks.money.mockRejectedValueOnce(
      z.string().guid().safeParse("invalid").error,
    );
    expect(
      (await GET(request, { params: Promise.resolve({ id: "account" }) }))
        .status,
    ).toBe(400);
  });
  it("keeps financial context out of shared caches", async () => {
    const response = await GET(
      new Request("https://app.invalid/api?scope=all"),
      { params: Promise.resolve({ id: "account" }) },
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.money).toHaveBeenCalledWith({ id: "actor" }, "account", {
      scope: "all",
    });
  });
});
