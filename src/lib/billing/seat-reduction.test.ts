import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  subscription: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
  order: vi.fn(),
  users: vi.fn(),
  updateUsers: vi.fn(),
  deleteWeb: vi.fn(),
  deleteMobile: vi.fn(),
  updateOrder: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { companySubscription: { findFirst: mocks.subscription }, $transaction: mocks.transaction } }));
import { applyDueSeatReductions } from "./seat-reduction";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.subscription.mockResolvedValue({ id: "subscription", sourceOrder: { id: "order", managerSeats: 0, salesSeats: 0, retainManagerUserIds: [], retainSalesUserIds: [], seatReductionAppliedAt: null } });
  mocks.order.mockResolvedValue({ managerSeats: 0, salesSeats: 0, retainManagerUserIds: [], retainSalesUserIds: [], seatReductionAppliedAt: null });
  mocks.users.mockResolvedValue([{ id: "manager", role: "MANAGER" }, { id: "sales", role: "SALES" }]);
  mocks.updateUsers.mockResolvedValue({ count: 2 });
  mocks.transaction.mockImplementation(async (work) => work({
    $queryRawUnsafe: mocks.lock,
    billingOrder: { findUnique: mocks.order, update: mocks.updateOrder },
    user: { findMany: mocks.users, updateMany: mocks.updateUsers },
    session: { deleteMany: mocks.deleteWeb },
    mobileSession: { deleteMany: mocks.deleteMobile },
    billingAuditEvent: { create: mocks.audit },
  }));
});

describe("billing seat reduction lifecycle writes", () => {
  it("globally deactivates removed Sales seats without removing workspace roles", async () => {
    await applyDueSeatReductions("company");
    const write = mocks.updateUsers.mock.calls[0][0];
    expect(write.data).toEqual({ isActive: false, salesAccessActive: false, accountAccessActive: false });
    expect(write.data).not.toHaveProperty("salesRole");
    expect(write.data).not.toHaveProperty("accountRole");
    expect(mocks.deleteWeb).toHaveBeenCalled();
    expect(mocks.deleteMobile).toHaveBeenCalled();
  });
});
