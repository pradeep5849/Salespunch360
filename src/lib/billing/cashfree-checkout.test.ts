import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({
  order: vi.fn(),
  start: vi.fn(),
  user: vi.fn(),
  company: vi.fn(),
  gateway: vi.fn(),
  verify: vi.fn(),
  activate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    billingOrder: { findFirst: m.order, updateMany: m.start },
    user: { findFirst: m.user },
    company: { findUnique: m.company },
  },
}));
vi.mock("./cashfree-client", () => ({ createCashfreeOrder: m.gateway }));
vi.mock("./cashfree-verification", () => ({ verifyCashfreePayment: m.verify }));
vi.mock("./service", () => ({ activateVerifiedPayment: m.activate }));
vi.mock("./unified-sales-team", () => ({
  unifiedTelecallerTargetForOrder: async () => 2,
}));
import {
  startCashfreeCheckout,
  inspectCashfreeCheckout,
} from "./cashfree-checkout";
const id = "11111111-1111-4111-8111-111111111111";
const actor = { id: "user", companyId: "tenant" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CASHFREE_ENV", "production");
  vi.stubEnv("CASHFREE_APP_ID", "isolated-fixture");
  vi.stubEnv("CASHFREE_SECRET_KEY", "isolated-fixture");
  m.order.mockResolvedValue({
    id,
    companyId: "tenant",
    status: "PENDING",
    paymentEnvironment: "production",
    expiresAt: new Date(Date.now() + 3600000),
    currency: "INR",
    totalAmount: new Prisma.Decimal("123.45"),
    billingPeriod: "YEARLY",
    adminSeats: 1,
    managerSeats: 2,
    salesSeats: 3,
    accountPackages: 1,
  });
  m.start.mockResolvedValue({ count: 1 });
  m.user.mockResolvedValue({ phone: "9876543210" });
  m.company.mockResolvedValue({ primaryPhone: null });
  m.gateway.mockResolvedValue({
    paymentSessionId: "fixture-session",
    providerOrderId: id,
  });
});
it("uses server amount/environment, stamps checkout atomically and never returns secrets", async () => {
  const result = await startCashfreeCheckout(actor, id);
  expect(result).toMatchObject({
    environment: "production",
    paymentSessionId: "fixture-session",
  });
  expect(JSON.stringify(result)).not.toContain("isolated-fixture");
  expect(m.gateway).toHaveBeenCalledWith(
    expect.objectContaining({
      amount: 123.45,
      orderId: id,
      returnUrl: expect.stringContaining("/workspace/billing/pending"),
    }),
  );
  expect(m.start).toHaveBeenCalledWith({
    where: { id, companyId: "tenant", status: "PENDING" },
    data: { providerOrderId: id },
  });
});
it("never starts gateway checkout after a competing cancellation", async () => {
  m.start.mockResolvedValue({ count: 0 });
  await expect(startCashfreeCheckout(actor, id)).rejects.toThrow(
    "ORDER_NOT_PAYABLE",
  );
  expect(m.gateway).not.toHaveBeenCalled();
});
it("does not send historical sandbox orders to production", async () => {
  m.order.mockResolvedValue({ ...(await m.order()), paymentEnvironment: null });
  await expect(startCashfreeCheckout(actor, id)).rejects.toThrow(
    "PAYMENT_ENVIRONMENT_MISMATCH",
  );
  expect(m.gateway).not.toHaveBeenCalled();
});
it.each(["PAID", "CANCELLED", "EXPIRED"])(
  "does not start %s orders",
  async (status) => {
    m.order.mockResolvedValue({ ...(await m.order()), status });
    await expect(startCashfreeCheckout(actor, id)).rejects.toThrow(
      "ORDER_NOT_PAYABLE",
    );
    expect(m.gateway).not.toHaveBeenCalled();
  },
);
it("uses the neutral browser return for Android", async () => {
  await startCashfreeCheckout(actor, id, "android");
  expect(m.gateway).toHaveBeenCalledWith(
    expect.objectContaining({
      returnUrl: expect.stringContaining("/payment/complete"),
    }),
  );
});
it("does not activate pending remote payments", async () => {
  m.verify.mockResolvedValue(null);
  expect(await inspectCashfreeCheckout(actor, id)).toMatchObject({
    activated: false,
    verified: false,
  });
  expect(m.activate).not.toHaveBeenCalled();
});
it("returns confirmation only after successful transactional activation", async () => {
  m.verify.mockResolvedValue({
    providerPaymentId: "cashfree_live_42",
    capturedAt: new Date(),
  });
  m.activate.mockRejectedValue(new Error("TRANSACTION_FAILED"));
  await expect(inspectCashfreeCheckout(actor, id)).rejects.toThrow(
    "TRANSACTION_FAILED",
  );
});
