import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  permission: vi.fn(),
  start: vi.fn(),
  inspect: vi.fn(),
  queue: vi.fn(),
  cookieSet: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({
  requirePermissionForMutation: m.permission,
}));
vi.mock("@/lib/billing/cashfree-checkout", () => ({
  startCashfreeCheckout: m.start,
  inspectCashfreeCheckout: m.inspect,
}));
vi.mock("@/lib/analytics/server", () => ({ queueCheckoutAnalytics: m.queue }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "v1:1:1" }), set: m.cookieSet }),
}));
import { POST } from "./route";
const orderId = "2ca57402-472d-45ba-81f5-d204b7ef5dcc";
function request(action = "verify") {
  return new Request("https://www.salespunch360.com/api/billing/cashfree", {
    method: "POST",
    headers: {
      origin: "https://www.salespunch360.com",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, orderId }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  m.permission.mockResolvedValue({ id: "user", companyId: "company" });
  m.start.mockResolvedValue({ paymentSessionId: "session" });
  m.inspect.mockResolvedValue({ activated: true, verified: true, orderId });
});
it("sets the functional confirmation cookie only after server verification and activation succeeds", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(m.cookieSet).toHaveBeenCalledWith(
    "sp360_billing_confirmation",
    orderId,
    expect.objectContaining({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/workspace/billing/success",
      maxAge: 1800,
    }),
  );
});
it.each(["PENDING", "FAILED", "CANCELLED", "EXPIRED"])(
  "does not authorize success for a %s verification result",
  async () => {
    m.inspect.mockResolvedValue({ activated: false, verified: false, orderId });
    expect((await POST(request())).status).toBe(200);
    expect(m.cookieSet).not.toHaveBeenCalled();
  },
);
it("does not authorize success if subscription activation fails", async () => {
  m.inspect.mockRejectedValue(new Error("ACTIVATION_FAILED"));
  expect((await POST(request())).status).toBe(403);
  expect(m.cookieSet).not.toHaveBeenCalled();
});
it("optional analytics failure never prevents payment session delivery", async () => {
  m.queue.mockRejectedValue(new Error("optional storage unavailable"));
  const response = await POST(request("start"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ paymentSessionId: "session" });
  expect(m.cookieSet).not.toHaveBeenCalled();
});
