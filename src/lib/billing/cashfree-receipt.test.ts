import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ order: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { billingOrder: { findFirst: m.order } } }));
import { renderCashfreeReceipt } from "./cashfree-receipt";
const order = {
  id: "fixture-order",
  billingPeriod: "YEARLY",
  adminSeats: 1,
  managerSeats: 2,
  salesSeats: 3,
  accountPackages: 1,
  payments: [
    {
      provider: "CASHFREE",
      status: "CAPTURED",
      providerPaymentId: "cashfree_live_123",
      amount: new Prisma.Decimal("99.75"),
      capturedAt: new Date(),
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  m.order.mockResolvedValue(order);
});
it.each(["CASHFREE", "CASHFREE_SANDBOX"])(
  "renders a real PDF for verified %s receipts under tenant scope",
  async (provider) => {
    m.order.mockResolvedValue({
      ...order,
      payments: [{ ...order.payments[0], provider }],
    });
    const pdf = await renderCashfreeReceipt("fixture-order", "tenant");
    expect(pdf).toBeInstanceOf(Uint8Array);
    expect((await PDFDocument.load(pdf!)).getPageCount()).toBe(1);
    expect(m.order).toHaveBeenCalledWith({
      where: { id: "fixture-order", companyId: "tenant", status: "PAID" },
      include: { payments: true },
    });
  },
);
it("refuses missing or foreign-tenant orders", async () => {
  m.order.mockResolvedValue(null);
  expect(await renderCashfreeReceipt("fixture-order", "other")).toBeNull();
});
it("refuses pending/failed payment records", async () => {
  m.order.mockResolvedValue({
    ...order,
    payments: [{ ...order.payments[0], status: "FAILED" }],
  });
  expect(await renderCashfreeReceipt("fixture-order", "tenant")).toBeNull();
});
