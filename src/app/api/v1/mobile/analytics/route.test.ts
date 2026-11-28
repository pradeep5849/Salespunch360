import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  can: vi.fn(),
  purchase: vi.fn(),
  checkout: vi.fn(),
  production: vi.fn(),
  internal: vi.fn(),
}));
vi.mock("@/lib/mobile/auth", () => ({
  authenticateMobileSalesToken: m.auth,
  mobileCan: m.can,
}));
vi.mock("@/lib/mobile/http", () => ({
  mobileJson: (body: unknown, status = 200) => Response.json(body, { status }),
  mobileUnauthorized: () => null,
}));
vi.mock("@/lib/analytics/server", () => ({
  claimPurchase: m.purchase,
  claimCheckout: m.checkout,
  productionAnalytics: m.production,
  internalCompany: m.internal,
}));
import { POST } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const body = {
  eventName: "purchase",
  orderId: id,
  analyticsConsent: true,
  advertisingConsent: true,
};
const request = (value: unknown = body) =>
  new Request("https://www.salespunch360.com/api/v1/mobile/analytics", {
    method: "POST",
    headers: { Authorization: "Bearer synthetic" },
    body: JSON.stringify(value),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({
    id: "actor",
    companyId: "tenant",
    salesRole: "PRIMARY_ADMIN",
  });
  m.can.mockReturnValue(true);
  m.production.mockReturnValue(true);
  m.internal.mockReturnValue(false);
  m.purchase.mockResolvedValue({
    transaction_id: id,
    value: 100.25,
    currency: "INR",
  });
});
it("uses the same authoritative purchase claim as web and only server values", async () => {
  const result = await (await POST(request())).json();
  expect(m.purchase).toHaveBeenCalledWith(
    { id: "actor", companyId: "tenant" },
    id,
  );
  expect(result).toMatchObject({
    eligible: true,
    params: {
      value: 100.25,
      currency: "INR",
      ads_eligible: 1,
      environment: "production",
    },
  });
});
it("does not turn repeat visits into duplicate events", async () => {
  m.purchase.mockResolvedValue(null);
  expect(await (await POST(request())).json()).toEqual({ eligible: false });
});
it.each([false, undefined])(
  "requires explicit analytics consent %s",
  async (analyticsConsent) => {
    expect((await POST(request({ ...body, analyticsConsent }))).status).toBe(
      400,
    );
    expect(m.purchase).not.toHaveBeenCalled();
  },
);
it("retains separate advertising consent", async () => {
  expect(
    await (await POST(request({ ...body, advertisingConsent: false }))).json(),
  ).toMatchObject({ params: { ads_eligible: 0 } });
});
it("rejects unauthenticated callers", async () => {
  m.auth.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
});
it("rejects non-owner billing access", async () => {
  m.can.mockReturnValue(false);
  expect((await POST(request())).status).toBe(403);
  expect(m.purchase).not.toHaveBeenCalled();
});
it.each(["test", "internal"])(
  "excludes %s runtime or tenants",
  async (kind) => {
    if (kind === "test") m.production.mockReturnValue(false);
    else m.internal.mockReturnValue(true);
    expect(await (await POST(request())).json()).toEqual({ eligible: false });
    expect(m.purchase).not.toHaveBeenCalled();
  },
);
it("rejects client-supplied transaction values and sensitive extras", async () => {
  expect(
    (
      await POST(
        request({ ...body, value: 1, email: "synthetic@example.invalid" }),
      )
    ).status,
  ).toBe(400);
});
