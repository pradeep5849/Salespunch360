import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({
  order: vi.fn(),
  audit: vi.fn(),
  subscription: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    billingOrder: { findFirst: m.order },
    billingAuditEvent: { findFirst: m.audit },
    companySubscription: { findFirst: m.subscription },
    analyticsEventReceipt: { createMany: m.create, updateMany: m.update },
  },
}));
vi.mock("@/lib/auth/authorization", () => ({ requirePermission: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: m.cookies }));
import {
  claimCheckout,
  claimPurchase,
  claimRegistration,
  confirmedOrderForActor,
  internalCompany,
  queueCheckoutAnalytics,
  queueRegistrationAnalytics,
  receiptKey,
} from "./server";
const actor = { id: "user", companyId: "tenant" };
const id = "2ca57402-472d-45ba-81f5-d204b7ef5dcc";
function order() {
  const capturedAt = new Date(Date.now() - 1000);
  return {
    id,
    companyId: "tenant",
    status: "PAID",
    totalAmount: new Prisma.Decimal("1499.75"),
    currency: "INR",
    paidAt: capturedAt,
    createdAt: new Date(Date.now() - 3600000),
    expiresAt: new Date(Date.now() + 3600000),
    billingPeriod: "YEARLY",
    adminSeats: 1,
    managerSeats: 2,
    salesSeats: 3,
    accountPackages: 0,
    payments: [
      {
        id: "payment",
        provider: "CASHFREE",
        status: "CAPTURED",
        providerPaymentId: "987654321",
        amount: new Prisma.Decimal("1499.75"),
        currency: "INR",
        capturedAt,
        manualReference: null,
      },
    ],
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_URL", "https://www.salespunch360.com");
  vi.stubEnv("ANALYTICS_ENABLED", "true");
  vi.stubEnv("CASHFREE_ENV", "production");
  vi.stubEnv("ANALYTICS_INTERNAL_COMPANY_IDS", "");
  m.order.mockResolvedValue(order());
  m.audit.mockResolvedValue({
    metadata: {
      orderId: id,
      subscriptionId: "subscription",
      providerEnvironment: "production",
    },
  });
  m.subscription.mockResolvedValue({
    id: "subscription",
    endsAt: new Date(Date.now() + 86400000),
  });
  m.create.mockResolvedValue({ count: 1 });
  m.update.mockResolvedValue({ count: 1 });
  m.cookies.mockResolvedValue({ get: () => ({ value: "v1:1:1" }) });
});
it("reads payment proof only inside the authorized tenant", async () => {
  expect(await confirmedOrderForActor(actor, id)).not.toBeNull();
  expect(m.order).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id, companyId: "tenant" } }),
  );
  expect(m.audit).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        companyId: "tenant",
        entityId: "payment",
        type: "PAYMENT_CAPTURED",
      }),
    }),
  );
  expect(m.subscription).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ companyId: "tenant", status: "ACTIVE" }),
    }),
  );
});
it("rejects direct URL orders without activation provenance or subscription", async () => {
  m.audit.mockResolvedValueOnce(null);
  expect(await confirmedOrderForActor(actor, id)).toBeNull();
  m.subscription.mockResolvedValueOnce(null);
  expect(await confirmedOrderForActor(actor, id)).toBeNull();
});
it.each(["PENDING", "FAILED", "CANCELLED", "EXPIRED"])(
  "does not load confirmation for %s",
  async (status) => {
    m.order.mockResolvedValue({ ...order(), status });
    expect(await claimPurchase(actor, id)).toBeNull();
    expect(m.create).not.toHaveBeenCalled();
  },
);
it("returns actual payment value and a stable merchant transaction ID", async () => {
  expect(await claimPurchase(actor, id)).toMatchObject({
    transaction_id: id,
    value: 1499.75,
    currency: "INR",
  });
  expect(m.create).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        keyHash: receiptKey("purchase", id),
        eventName: "purchase",
      }),
    ],
    skipDuplicates: true,
  });
});
it("does not emit repeated callbacks, refreshes or revisits after the atomic claim", async () => {
  m.create.mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 });
  expect(await claimPurchase(actor, id)).not.toBeNull();
  expect(await claimPurchase(actor, id)).toBeNull();
  expect(await claimPurchase(actor, id)).toBeNull();
});
it("shows verified sandbox confirmation but never claims production revenue", async () => {
  const value = order();
  value.payments[0].provider = "CASHFREE_SANDBOX";
  value.payments[0].providerPaymentId = "cashfree_sandbox_123";
  m.order.mockResolvedValue(value);
  expect(await confirmedOrderForActor(actor, id)).not.toBeNull();
  expect(await claimPurchase(actor, id)).toBeNull();
  expect(m.create).not.toHaveBeenCalled();
});
it("excludes internal companies before creating a purchase claim", async () => {
  vi.stubEnv("ANALYTICS_INTERNAL_COMPANY_IDS", "another, tenant");
  expect(internalCompany("tenant")).toBe(true);
  expect(await claimPurchase(actor, id)).toBeNull();
  expect(m.create).not.toHaveBeenCalled();
});
it("claims signup only from a fresh unclaimed successful registration receipt", async () => {
  expect(await claimRegistration(actor.id)).toEqual({ method: "website" });
  m.update.mockResolvedValue({ count: 0 });
  expect(await claimRegistration(actor.id)).toBeNull();
  expect(m.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        keyHash: receiptKey("sign_up", actor.id),
        claimedAt: null,
        eventName: "sign_up",
      }),
    }),
  );
});
it("never records signup proof before analytics consent", async () => {
  m.cookies.mockResolvedValue({ get: () => ({ value: "v1:0:0" }) });
  await queueRegistrationAnalytics(actor.id, actor.companyId);
  expect(m.create).not.toHaveBeenCalled();
});
it("optional registration/checkout storage failures cannot fail business actions", async () => {
  m.create.mockRejectedValue(new Error("database unavailable"));
  await expect(
    queueRegistrationAnalytics(actor.id, actor.companyId),
  ).resolves.toBeUndefined();
  await expect(
    queueCheckoutAnalytics(actor.id, actor.companyId, id, true),
  ).resolves.toBeUndefined();
});
it("a checkout claim requires a real start receipt and valid unexpired pending order", async () => {
  m.order.mockResolvedValue({ ...order(), status: "PENDING" });
  expect(await claimCheckout(actor, id)).toMatchObject({ value: 1499.75 });
  expect(m.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        context: "cashfree:production",
        eventName: "begin_checkout",
        claimedAt: null,
      }),
    }),
  );
  m.update.mockResolvedValue({ count: 0 });
  expect(await claimCheckout(actor, id)).toBeNull();
});
it("never reclassifies sandbox checkout proof as production after a mode change", async () => {
  vi.stubEnv("CASHFREE_ENV", "sandbox");
  await queueCheckoutAnalytics(actor.id, actor.companyId, id, true);
  expect(m.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: [expect.objectContaining({ context: "cashfree:sandbox" })],
    }),
  );
  expect(await claimCheckout(actor, id)).toBeNull();
});
it("stores only hashes and event lifecycle metadata, not source identities or payloads", async () => {
  await queueRegistrationAnalytics(actor.id, actor.companyId);
  const data = m.create.mock.calls[0][0].data[0];
  expect(data.keyHash).toMatch(/^[a-f0-9]{64}$/);
  expect(Object.keys(data).sort()).toEqual(["eventName", "keyHash"]);
  expect(JSON.stringify(data)).not.toContain(actor.companyId);
});
