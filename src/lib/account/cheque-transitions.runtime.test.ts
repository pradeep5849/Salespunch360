import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  transaction: vi.fn(),
  query: vi.fn(),
  cheque: vi.fn(),
  update: vi.fn(),
  result: vi.fn(),
  audit: vi.fn(),
  priorAudit: vi.fn(),
  journal: vi.fn(),
  reverse: vi.fn(),
  branch: vi.fn(),
  account: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { $transaction: m.transaction } }));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
  requirePermission: vi.fn(),
  requirePermissionForMutation: vi.fn(),
}));
vi.mock("@/lib/accounting/service", () => ({
  reverseJournalInTx: m.reverse,
  postJournalInTx: vi.fn(),
}));
import { createChequeForActor, transitionChequeForActor } from "./money";
const id = "00000000-0000-4000-8000-000000000001",
  branch = "00000000-0000-4000-8000-000000000002",
  journal = "00000000-0000-4000-8000-000000000003",
  account = "00000000-0000-4000-8000-000000000004";
const actor = {
  id,
  companyId: id,
  name: "Admin",
  email: "a@example.test",
  role: "ACCOUNT_USER" as const,
  isActive: true,
  managerType: null,
  salesRole: null,
  salesAccessActive: false,
  accountAccessActive: true,
  accountRole: "ACCOUNT_ADMIN" as const,
  branchAccessScope: "ALL_BRANCHES" as const,
  branchIds: [],
};
const date = new Date("2026-10-09"),
  row = {
    id,
    companyId: id,
    branchId: branch,
    moneyAccountId: account,
    chequeNumber: "123",
    chequeDate: date,
    partyName: "Customer",
    reference: null,
    status: "CLEARED",
    journalEntryId: journal,
    clearedDate: date,
  };
const tx = {
  $queryRaw: m.query,
  cheque: {
    findFirst: m.cheque,
    updateMany: m.update,
    findFirstOrThrow: m.result,
    create: m.create,
  },
  accountOperationalAudit: { create: m.audit, findFirst: m.priorAudit },
  journalEntry: { findFirst: m.journal },
  branch: { findFirst: m.branch },
  moneyAccount: { findFirst: m.account },
};
describe("A066 atomic cheque lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.transaction.mockImplementation((fn) => fn(tx));
    m.cheque.mockResolvedValue(row);
    m.update.mockResolvedValue({ count: 1 });
    m.result.mockResolvedValue({ ...row, status: "BOUNCED" });
    m.journal.mockResolvedValue({ id: journal });
    m.branch.mockResolvedValue({ id: branch });
    m.account.mockResolvedValue({ id: account });
  });
  it("blocks legacy arbitrary-journal reversal before any financial write", async () => {
    await expect(
      transitionChequeForActor(actor, id, "BOUNCED", date),
    ).rejects.toThrow("LEGACY_CHEQUE_SOURCE_REQUIRED");
    expect(m.reverse).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });
  it("requires the versioned financial action for normalized cheques", async () => {
    m.cheque.mockResolvedValue({ ...row, settlementId: journal });
    await expect(
      transitionChequeForActor(actor, id, "BOUNCED", date),
    ).rejects.toThrow("CHEQUE_FINANCIAL_ACTION_REQUIRED");
    expect(m.reverse).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });
  it("checks company and assigned branch scope before any write", async () => {
    m.cheque.mockResolvedValue(null);
    await expect(
      transitionChequeForActor(
        {
          ...actor,
          branchAccessScope: "SELECTED_BRANCHES",
          branchIds: [branch],
        },
        id,
        "BOUNCED",
        date,
      ),
    ).rejects.toThrow();
    expect(m.cheque).toHaveBeenCalledWith({
      where: { id, companyId: id, branchId: { in: [branch] } },
    });
    expect(m.reverse).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });
  it("acknowledges an identical retry without repeating reversal or audit", async () => {
    m.cheque.mockResolvedValue({ ...row, status: "BOUNCED" });
    m.priorAudit.mockResolvedValue({
      metadata: { to: "BOUNCED", date: "2026-10-09" },
    });
    await transitionChequeForActor(actor, id, "BOUNCED", date);
    expect(m.reverse).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });
  it("rejects changed replay date", async () => {
    m.cheque.mockResolvedValue({ ...row, status: "BOUNCED" });
    m.priorAudit.mockResolvedValue({
      metadata: { to: "BOUNCED", date: "2026-10-08" },
    });
    await expect(
      transitionChequeForActor(actor, id, "BOUNCED", date),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    expect(m.reverse).not.toHaveBeenCalled();
  });
  it("rejects stale incompatible transition", async () => {
    m.cheque.mockResolvedValue({ ...row, status: "CANCELLED" });
    await expect(
      transitionChequeForActor(actor, id, "DEPOSITED", date),
    ).rejects.toThrow("LEGACY_CHEQUE_SOURCE_REQUIRED");
    expect(m.update).not.toHaveBeenCalled();
  });
  it.each(["update", "audit"] as const)(
    "propagates legacy cancellation %s failure",
    async (stage) => {
      m.cheque.mockResolvedValue({
        ...row,
        status: "RECEIVED",
        journalEntryId: null,
      });
      m[stage].mockRejectedValue(new Error("boundary failure"));
      await expect(
        transitionChequeForActor(actor, id, "CANCELLED", date),
      ).rejects.toThrow("boundary failure");
      expect(m.reverse).not.toHaveBeenCalled();
    },
  );
  it("rejects a lost legacy cancellation race", async () => {
    m.cheque.mockResolvedValue({
      ...row,
      status: "RECEIVED",
      journalEntryId: null,
    });
    m.update.mockResolvedValue({ count: 0 });
    await expect(
      transitionChequeForActor(actor, id, "CANCELLED", date),
    ).rejects.toThrow("INVALID_CHEQUE_TRANSITION");
    expect(m.audit).not.toHaveBeenCalled();
  });
  it("does not silently clear a cheque without a receipt journal", async () => {
    m.cheque.mockResolvedValue({
      ...row,
      status: "DEPOSITED",
      journalEntryId: null,
    });
    await expect(
      transitionChequeForActor(actor, id, "CLEARED", date),
    ).rejects.toThrow("LEGACY_CHEQUE_SOURCE_REQUIRED");
    expect(m.update).not.toHaveBeenCalled();
  });
  it("rejects uninitialised completed creation states", async () => {
    await expect(
      createChequeForActor(actor, {
        branchId: branch,
        moneyAccountId: account,
        chequeNumber: "123",
        chequeDate: date,
        partyName: "Customer",
        status: "CLEARED",
      }),
    ).rejects.toThrow("INVALID_CHEQUE_INITIAL_STATUS");
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("rejects legacy free-text creation with no amount, party identity or retry identity", async () => {
    await expect(
      createChequeForActor(actor, {
        branchId: branch,
        moneyAccountId: account,
        chequeNumber: "123",
        chequeDate: date,
        partyName: "Customer",
        status: "RECEIVED",
      }),
    ).rejects.toThrow();
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });
});
