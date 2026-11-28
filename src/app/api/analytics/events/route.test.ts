import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  cookies: vi.fn(),
  user: vi.fn(),
  permission: vi.fn(),
  signup: vi.fn(),
  checkout: vi.fn(),
  purchase: vi.fn(),
  production: vi.fn(),
  internal: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: m.cookies }));
vi.mock("@/lib/auth/session", () => ({ getAuthenticatedUser: m.user }));
vi.mock("@/lib/auth/authorization", () => ({
  requirePermissionForMutation: m.permission,
}));
vi.mock("@/lib/analytics/server", () => ({
  claimRegistration: m.signup,
  claimCheckout: m.checkout,
  claimPurchase: m.purchase,
  productionAnalytics: m.production,
  internalCompany: m.internal,
}));
import { POST } from "./route";
const id = "2ca57402-472d-45ba-81f5-d204b7ef5dcc";
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://www.salespunch360.com/api/analytics/events", {
    method: "POST",
    headers: {
      origin: "https://www.salespunch360.com",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  m.cookies.mockResolvedValue({ get: () => ({ value: "v1:1:1" }) });
  m.user.mockResolvedValue({ id: "user", companyId: "company" });
  m.permission.mockResolvedValue({ id: "user", companyId: "company" });
  m.production.mockReturnValue(true);
  m.internal.mockReturnValue(false);
  m.signup.mockResolvedValue({ method: "website" });
  m.purchase.mockResolvedValue({
    transaction_id: id,
    value: 1499.75,
    currency: "INR",
  });
});
it("rejects cross-origin tracking writes", async () => {
  expect(
    (
      await POST(
        request(
          { eventName: "purchase", orderId: id },
          { origin: "https://evil.example" },
        ),
      )
    ).status,
  ).toBe(403);
  expect(m.purchase).not.toHaveBeenCalled();
});
it("rejects client-supplied values and personal data", async () => {
  expect(
    (
      await POST(
        request({
          eventName: "purchase",
          orderId: id,
          value: 1,
          email: "private@example.invalid",
        }),
      )
    ).status,
  ).toBe(400);
  expect(m.purchase).not.toHaveBeenCalled();
});
it.each(["sec-gpc", "dnt"])(
  "honors browser privacy signals %s",
  async (header) => {
    expect(
      (await POST(request({ eventName: "sign_up" }, { [header]: "1" }))).status,
    ).toBe(204);
    expect(m.signup).not.toHaveBeenCalled();
  },
);
it("does not claim events without consent", async () => {
  m.cookies.mockResolvedValue({ get: () => ({ value: "v1:0:0" }) });
  expect(
    (await POST(request({ eventName: "purchase", orderId: id }))).status,
  ).toBe(204);
  expect(m.user).not.toHaveBeenCalled();
});
it("returns secondary signup parameters only after real proof", async () => {
  const response = await POST(request({ eventName: "sign_up" }));
  expect(await response.json()).toEqual({
    eventName: "sign_up",
    params: { method: "website", environment: "production", ads_eligible: 1 },
  });
});
it("keeps analytics-only events ineligible for advertising import", async () => {
  m.cookies.mockResolvedValue({ get: () => ({ value: "v1:1:0" }) });
  expect(
    (await (await POST(request({ eventName: "sign_up" }))).json()).params
      .ads_eligible,
  ).toBe(0);
});
it("requires billing permission and server proof for purchase", async () => {
  const response = await POST(request({ eventName: "purchase", orderId: id }));
  expect(response.status).toBe(200);
  expect(m.permission).toHaveBeenCalledWith("SALES_BILLING");
  expect(m.purchase).toHaveBeenCalledWith(
    { id: "user", companyId: "company" },
    id,
  );
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
it("does not emit duplicate or unverified purchase results", async () => {
  m.purchase.mockResolvedValue(null);
  expect(
    (await POST(request({ eventName: "purchase", orderId: id }))).status,
  ).toBe(204);
});
it("does not claim internal-company events", async () => {
  m.internal.mockReturnValue(true);
  expect(
    (await POST(request({ eventName: "purchase", orderId: id }))).status,
  ).toBe(204);
  expect(m.purchase).not.toHaveBeenCalled();
});
it("keeps analytics unavailable errors separate from payments", async () => {
  m.purchase.mockRejectedValue(new Error("private diagnostic"));
  const r = await POST(request({ eventName: "purchase", orderId: id }));
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("private diagnostic");
});
