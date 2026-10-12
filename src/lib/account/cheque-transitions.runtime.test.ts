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
  it("uses one serializable transaction for reversal, status and audit", async () => {
    await transitionChequeForActor(actor, id, "BOUNCED", date);
    expect(m.transaction).toHaveBeenCalledOnce();
    expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(m.reverse).toHaveBeenCalledWith(tx, actor, {
      journalEntryId: journal,
      entryDate: date,
      reason: "Cheque bounced",
    });
    expect(m.update).toHaveBeenCalledWith({
      where: { id, companyId: id, status: "CLEARED" },
      data: { status: "BOUNCED", clearedDate: date },
    });
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "CHEQUE_STATUS_CHANGED",
          metadata: { from: "CLEARED", to: "BOUNCED", date: "2026-10-09" },
        }),
      }),
    );
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
    ).rejects.toThrow("INVALID_CHEQUE_TRANSITION");
    expect(m.update).not.toHaveBeenCalled();
  });
  it.each(["reverse", "update", "audit"])(
    "propagates %s boundary failure through the transaction",
    async (stage) => {
      m[stage as "reverse" | "update" | "audit"].mockRejectedValue(
        new Error("boundary failure"),
      );
      await expect(
        transitionChequeForActor(actor, id, "BOUNCED", date),
      ).rejects.toThrow("boundary failure");
      expect(m.transaction).toHaveBeenCalledOnce();
    },
  );
  it("rejects conditional status update lost race", async () => {
    m.update.mockResolvedValue({ count: 0 });
    await expect(
      transitionChequeForActor(actor, id, "BOUNCED", date),
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
    ).rejects.toThrow("CHEQUE_RECEIPT_REQUIRED");
    expect(m.update).not.toHaveBeenCalled();
  });
  it("validates original journal company and branch before reversal", async () => {
    m.journal.mockResolvedValue(null);
    await expect(
      transitionChequeForActor(actor, id, "BOUNCED", date),
    ).rejects.toThrow("INVALID_JOURNAL");
    expect(m.journal).toHaveBeenCalledWith({
      where: { id: journal, companyId: id, branchId: branch, status: "POSTED" },
    });
    expect(m.reverse).not.toHaveBeenCalled();
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
  it("creates and audits a new Open cheque within one transaction", async () => {
    m.cheque.mockResolvedValue(null);
    m.create.mockResolvedValue({
      ...row,
      status: "RECEIVED",
      journalEntryId: null,
    });
    await createChequeForActor(actor, {
      branchId: branch,
      moneyAccountId: account,
      chequeNumber: "123",
      chequeDate: date,
      partyName: "Customer",
      status: "RECEIVED",
    });
    expect(m.create).toHaveBeenCalledOnce();
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "CHEQUE_CREATED" }),
      }),
    );
    expect(m.reverse).not.toHaveBeenCalled();
  });
});
