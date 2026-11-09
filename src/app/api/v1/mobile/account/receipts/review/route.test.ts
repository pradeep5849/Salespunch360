import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), review: vi.fn() }));
vi.mock("@/lib/mobile/auth", () => ({ authenticateMobileToken: m.auth }));
vi.mock("@/lib/mobile/account-transactions", () => ({
  mobileAccountActor: (user: unknown) => user,
}));
vi.mock("@/lib/account/receipt-entry-review", () => ({
  receiptEntryReviewForActor: m.review,
}));
import { GET } from "./route";
const user = {
  id: "actor",
  companyId: "company",
  role: "ACCOUNT_USER",
  accountRole: "ACCOUNT_ADMIN",
  accountAccessActive: true,
  isActive: true,
  productEdition: "SALESPUNCH360_ACCOUNT",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue(user);
  m.review.mockResolvedValue({
    balance: "-507.00",
    receiptNumber: "CR-000001",
    advanceNumber: "CA-000001",
  });
});
it("authenticates review and keeps financial data out of shared caches", async () => {
  const result = await GET(
    new Request("https://app.invalid/review?branchId=branch&customerId=party", {
      headers: { authorization: "Bearer fixture" },
    }),
  );
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(m.review).toHaveBeenCalledWith(user, {
    branchId: "branch",
    customerId: "party",
  });
});
it("rejects a Sales-only edition even with stale Account role flags before reading balances", async () => {
  m.auth.mockResolvedValue({ ...user, productEdition: "SALESPUNCH360" });
  expect(
    (await GET(new Request("https://app.invalid/review?branchId=branch")))
      .status,
  ).toBe(403);
  expect(m.review).not.toHaveBeenCalled();
});
it("never reads review data for an unauthenticated or inactive user", async () => {
  m.auth.mockRejectedValueOnce(new Error("MOBILE_UNAUTHORIZED"));
  expect((await GET(new Request("https://app.invalid/review"))).status).toBe(
    401,
  );
  m.auth.mockResolvedValue({ ...user, accountAccessActive: false });
  expect(
    (await GET(new Request("https://app.invalid/review?branchId=branch")))
      .status,
  ).toBe(403);
  expect(m.review).not.toHaveBeenCalled();
});
