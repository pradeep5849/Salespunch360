import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ prices: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: { billingPrice: { findMany: m.prices } } }));
import { getPublicPricing } from "./public-pricing";
beforeEach(() => vi.resetAllMocks());
it("publishes the authoritative current Account package price with fractional precision", async () => {
  m.prices.mockResolvedValue([
    { role: "ACCOUNT_PACKAGE", period: "YEARLY", amount: "799.25" },
    { role: "SALES", period: "YEARLY", amount: "499.75" },
  ]);
  const p = await getPublicPricing();
  expect(p.account.yearlyPrice).toBe(799.25);
  expect(
    p.sales.find((x) => x.role === "SALES" && x.period === "YEARLY")?.amount,
  ).toBe(499.75);
  expect(p.sales).toHaveLength(9);
  expect(p.sales.every((x) => x.role !== ("ACCOUNT_PACKAGE" as string))).toBe(
    true,
  );
});
it("preserves documented defaults if versioned prices are absent", async () => {
  m.prices.mockResolvedValue([]);
  expect((await getPublicPricing()).account.yearlyPrice).toBe(700);
});
