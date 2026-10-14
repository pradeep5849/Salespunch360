import { beforeEach, describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({
  transfer: vi.fn(),
  owner: vi.fn(),
  loan: vi.fn(),
  payment: vi.fn(),
  query: vi.fn(),
  lock: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        $executeRaw: m.lock,
        $queryRaw: m.query,
        moneyTransfer: { findFirst: m.transfer },
        ownerTransaction: { findFirst: m.owner },
        loan: { findFirst: m.loan },
        loanPayment: { findFirst: m.payment },
      }),
  },
}));
import {
  createMoneyTransferForActor,
  postOwnerTransactionForActor,
  createAndReceiveLoanForActor,
  postLoanPaymentForActor,
} from "./money";
const id = "00000000-0000-4000-8000-000000000001",
  branch = "00000000-0000-4000-8000-000000000002",
  account = "00000000-0000-4000-8000-000000000003",
  other = "00000000-0000-4000-8000-000000000004";
const actor = {
  id,
  name: "Replay test administrator",
  email: "replay@example.test",
  role: "ACCOUNT_USER" as const,
  isActive: true,
  managerType: null,
  salesRole: null,
  salesAccessActive: false,
  accountAccessActive: true,
  companyId: id,
  accountRole: "ACCOUNT_ADMIN" as const,
  branchAccessScope: "ALL_BRANCHES" as const,
  branchIds: [],
};
const date = new Date("2026-10-09"),
  amount = new Prisma.Decimal(10),
  key = "persisted-request-key";
const transfer = {
  branchId: branch,
  sourceAccountId: account,
  destinationAccountId: other,
  transferDate: "2026-10-09",
  amount: "10",
  idempotencyKey: key,
};
const owner = {
  branchId: branch,
  ownerFinancialAccountId: other,
  moneyAccountId: account,
  type: "INVESTMENT",
  transactionDate: "2026-10-09",
  amount: "10",
  idempotencyKey: key,
};
const loan = {
  branchId: branch,
  moneyAccountId: account,
  lender: "Lender",
  loanType: "TERM",
  principal: "10",
  startDate: "2026-10-09",
  idempotencyKey: key,
};
const payment = {
  loanId: other,
  moneyAccountId: account,
  principal: "10",
  interest: "0",
  charges: "0",
  paymentDate: "2026-10-09",
  idempotencyKey: key,
};
beforeEach(() => {
  vi.clearAllMocks();
  m.transfer.mockResolvedValue({ ...transfer, id, transferDate: date, amount });
  m.owner.mockResolvedValue({ ...owner, id, transactionDate: date, amount });
  m.loan.mockResolvedValue({
    ...loan,
    id,
    branchId: branch,
    startDate: date,
    principal: amount,
    interestRate: null,
    maturityDate: null,
  });
  m.payment.mockResolvedValue({
    ...payment,
    id,
    paymentDate: date,
    principal: amount,
    interest: new Prisma.Decimal(0),
    charges: new Prisma.Decimal(0),
  });
});
describe("A064 A065 A067 financial request replay", () => {
  it.each([
    ["transfer", createMoneyTransferForActor, transfer],
    ["owner", postOwnerTransactionForActor, owner],
    ["loan", createAndReceiveLoanForActor, loan],
    ["payment", postLoanPaymentForActor, payment],
  ] as const)(
    "replays matching %s without another journal",
    async (_name, operation, input) => {
      expect((await operation(actor, input)).id).toBe(id);
      expect(m.lock).toHaveBeenCalledOnce();
    },
  );
  it.each([
    ["transfer", createMoneyTransferForActor, { ...transfer, amount: "11" }],
    ["transfer description", createMoneyTransferForActor, { ...transfer, description:"Different context" }],
    ["owner", postOwnerTransactionForActor, { ...owner, amount: "11" }],
    ["loan", createAndReceiveLoanForActor, { ...loan, principal: "11" }],
    ["payment", postLoanPaymentForActor, { ...payment, interest: "1" }],
  ] as const)(
    "rejects altered %s payload",
    async (_name, operation, input) =>
      await expect(operation(actor, input)).rejects.toThrow(
        "IDEMPOTENCY_CONFLICT",
      ),
  );
  it.each([
    ["transfer", createMoneyTransferForActor, transfer],
    ["owner", postOwnerTransactionForActor, owner],
    ["loan", createAndReceiveLoanForActor, loan],
    ["payment", postLoanPaymentForActor, payment],
  ] as const)(
    "checks branch authorization on %s replay",
    async (_name, operation, input) =>
      await expect(
        operation(
          { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
          input,
        ),
      ).rejects.toThrow(),
  );
  it("accepts blank optional loan terms on an otherwise matching retry", async () =>
    expect(
      (
        await createAndReceiveLoanForActor(actor, {
          ...loan,
          interestRate: "",
          maturityDate: "",
        })
      ).id,
    ).toBe(id));
  it("keeps the company predicate on replay lookups", async () => {
    await createMoneyTransferForActor(actor, transfer);
    expect(m.transfer.mock.calls[0][0].where).toMatchObject({
      companyId: id,
      idempotencyKey: key,
    });
  });
});
