import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  branch: vi.fn(),
  customer: vi.fn(),
  series: vi.fn(),
  balance: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    branch: { findFirst: m.branch },
    customer: { findFirst: m.customer },
    numberingSeries: { findMany: m.series },
  },
}));
vi.mock("./party-balance", () => ({ scopedPartyBalance: m.balance }));
import { receiptEntryReviewForActor } from "./receipt-entry-review";
import type { ProjectActor } from "./projects";
const companyId = "11111111-1111-4111-8111-111111111111",
  branchId = "22222222-2222-4222-8222-222222222222",
  customerId = "33333333-3333-4333-8333-333333333333";
const actor = {
  id: customerId,
  companyId,
  role:"ACCOUNT_USER",accountAccessActive:true,isActive:true,
  accountRole: "ACCOUNT_ADMIN",
  branchAccessScope: "ALL_BRANCHES",
  branchIds: [],
} as unknown as ProjectActor;
beforeEach(() => {
  vi.clearAllMocks();
  m.branch.mockResolvedValue({ id: branchId });
  m.customer.mockResolvedValue({ id: customerId });
  m.series.mockResolvedValue([]);
  m.balance.mockResolvedValue("-507.00");
});
it("returns scoped credit balance and non-reserving receipt previews", async () => {
  expect(
    await receiptEntryReviewForActor(actor, { branchId, customerId }),
  ).toEqual({
    balance: "-507.00",
    receiptNumber: "CR-000001",
    advanceNumber: "CA-000001",
  });
  expect(m.balance).toHaveBeenCalledWith(companyId, customerId, true, [
    branchId,
  ]);
});
it("does not read party history before validating current company and branch access", async () => {
  await expect(
    receiptEntryReviewForActor(
      { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
      { branchId, customerId },
    ),
  ).rejects.toThrow();
  expect(m.branch).not.toHaveBeenCalled();
  m.customer.mockResolvedValue(null);
  await expect(
    receiptEntryReviewForActor(actor, { branchId, customerId }),
  ).rejects.toThrow();
  expect(m.balance).not.toHaveBeenCalled();
});
it("supports no selected customer and respects inactive numbering series", async () => {
  m.series.mockResolvedValue([
    { seriesKey: "CUSTOMER_RECEIPT", isActive: false },
  ]);
  const result = await receiptEntryReviewForActor(actor, { branchId });
  expect(result.balance).toBeNull();
  expect(result.receiptNumber).toBeNull();
  expect(m.balance).not.toHaveBeenCalled();
});
