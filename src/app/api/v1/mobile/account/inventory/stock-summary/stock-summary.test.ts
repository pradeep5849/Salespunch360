import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/lib/auth/authorization";
import { z } from "zod";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  report: vi.fn(),
  export: vi.fn(),
}));
vi.mock("@/lib/mobile/auth", () => ({ authenticateMobileToken: mocks.auth }));
vi.mock("@/lib/mobile/account-inventory", () => ({
  mobileStockSummary: mocks.report,
  mobileStockSummaryExport: mocks.export,
}));
import { GET as report } from "./route";
import { GET as download } from "./[format]/route";
describe("mobile stock summary API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ id: "actor" });
    mocks.report.mockResolvedValue({ filtered: [] });
    mocks.export.mockResolvedValue(Buffer.from("%PDF-test"));
  });
  it("authenticates and forwards the complete scoped filter set", async () => {
    const request = new Request(
      "https://app.invalid/api?branchId=branch&asOf=2026-10-10&status=false",
      { headers: { authorization: "Bearer test" } },
    );
    expect((await report(request)).status).toBe(200);
    expect(mocks.auth).toHaveBeenCalledWith("Bearer test");
    expect(mocks.report).toHaveBeenCalledWith(
      { id: "actor" },
      { branchId: "branch", asOf: "2026-10-10", status: "false" },
    );
  });
  it("returns controlled unauthenticated/denied/invalid-filter responses", async () => {
    const request = new Request("https://app.invalid/api");
    mocks.auth.mockRejectedValueOnce(new Error("MOBILE_UNAUTHORIZED"));
    expect((await report(request)).status).toBe(401);
    expect(mocks.report).not.toHaveBeenCalled();
    mocks.report.mockRejectedValueOnce(new AuthorizationError());
    expect((await report(request)).status).toBe(403);
    mocks.report.mockRejectedValueOnce(
      z.string().date().safeParse("2026-02-30").error,
    );
    expect((await report(request)).status).toBe(400);
  });
  it("shares only supported formats and scoped private bytes", async () => {
    const request = new Request(
      "https://app.invalid/api?branchId=branch&status=false",
    );
    const response = await download(request, {
      params: Promise.resolve({ format: "pdf" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("%PDF-test");
    expect(mocks.export).toHaveBeenCalledWith(
      { id: "actor" },
      { branchId: "branch", status: "false" },
      "pdf",
    );
    mocks.export.mockClear();
    expect(
      (
        await download(request, {
          params: Promise.resolve({ format: "other" }),
        })
      ).status,
    ).toBe(404);
    expect(mocks.export).not.toHaveBeenCalled();
  });
});
