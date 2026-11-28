import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const m = vi.hoisted(() => ({
  cookie: vi.fn(),
  confirmed: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error("REDIRECT:" + path);
  }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: m.cookie }) }));
vi.mock("@/lib/analytics/server", () => ({
  confirmedBillingSuccess: m.confirmed,
}));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/components/analytics/purchase-conversion", () => ({
  PurchaseConversion: ({ orderId }: { orderId: string }) => (
    <span data-conversion-order={orderId} />
  ),
}));
import Page from "./page";
const id = "2ca57402-472d-45ba-81f5-d204b7ef5dcc";
beforeEach(() => {
  vi.clearAllMocks();
  m.cookie.mockReturnValue(undefined);
  m.confirmed.mockResolvedValue({
    order: { id, currency: "INR" },
    payment: {
      amount: "1499.75",
      provider: "CASHFREE",
      providerPaymentId: "987654321",
      capturedAt: new Date("2026-11-28T10:00:00Z"),
    },
  });
});
it("preserves successful payment UI, actual amount, receipt and navigation", async () => {
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ order: id }) }),
  );
  expect(html).toContain("Payment successful");
  expect(html).toContain("1,499.75");
  expect(html).toContain("Subscription payment verified and activated");
  expect(html).toContain("Download Receipt");
  expect(html).toContain("Back to Billing");
  expect(html).toContain("/api/billing/cashfree/receipt?order=" + id);
  expect(html).toContain("data-conversion-order");
});
it.each([{}, { order: "invented" }])(
  "does not produce confirmation or tracking from a direct invalid URL %o",
  async (q) => {
    await expect(Page({ searchParams: Promise.resolve(q) })).rejects.toThrow(
      "REDIRECT:/workspace/billing",
    );
    expect(m.confirmed).not.toHaveBeenCalled();
  },
);
it("redirects unverified, failed, cancelled, expired and foreign-tenant orders without mounting conversion UI", async () => {
  m.confirmed.mockResolvedValue(null);
  await expect(
    Page({ searchParams: Promise.resolve({ order: id }) }),
  ).rejects.toThrow("REDIRECT:/workspace/billing/pending?order=" + id);
});
it("keeps sandbox receipts and success UI without a production conversion component", async () => {
  m.confirmed.mockResolvedValue({
    order: { id, currency: "INR" },
    payment: {
      amount: "1499.75",
      provider: "CASHFREE_SANDBOX",
      providerPaymentId: "cashfree_sandbox_123",
      capturedAt: new Date(),
    },
  });
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ order: id }) }),
  );
  expect(html).toContain("Sandbox test payment");
  expect(html).toContain("Download Receipt");
  expect(html).not.toContain("data-conversion-order");
});

it("supports the exact success path after server verification sets the functional order cookie", async () => {
  m.cookie.mockReturnValue({ value: id });
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({}) }),
  );
  expect(m.confirmed).toHaveBeenCalledWith(id);
  expect(html).toContain("Payment successful");
});
