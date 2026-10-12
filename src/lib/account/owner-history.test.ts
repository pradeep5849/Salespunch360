import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const calls = vi.hoisted(() => ({
  owner: vi.fn(),
  rows: vi.fn(),
  count: vi.fn(),
  journals: vi.fn(),
  accounts: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    ownerFinancialAccount: { findFirst: calls.owner },
    ownerTransaction: { findMany: calls.rows, count: calls.count },
    journalEntry: { findMany: calls.journals },
    moneyAccount: { findMany: calls.accounts },
  },
}));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
}));
import { ownerHistoryForActor } from "./owner-history";
import type { ProjectActor } from "./projects";
const id = "00000000-0000-4000-8000-000000000001",
  actor = {
    companyId: "company",
    accountRole: "ACCOUNTANT",
    isActive: true,
    accountAccessActive: true,
    branchAccessScope: "SELECTED_BRANCHES",
    branchIds: ["branch"],
  } as ProjectActor;
beforeEach(() => {
  vi.clearAllMocks();
  calls.owner.mockResolvedValue({ id, name: "Partner", isActive: false });
  calls.rows.mockResolvedValue([
    {
      id: "tx",
      type: "CAPITAL_WITHDRAWAL",
      amount: new Prisma.Decimal("10"),
      transactionDate: new Date("2026-10-10"),
      reference: "ref",
      moneyAccountId: "bank",
      journalEntryId: "journal",
    },
  ]);
  calls.count.mockResolvedValue(60);
  calls.journals.mockResolvedValue([
    {
      id: "journal",
      status: "REVERSED",
      reversedBy: {
        entryDate: new Date("2026-10-11"),
        reversalReason: "Correction",
      },
    },
  ]);
  calls.accounts.mockResolvedValue([{ id: "bank", name: "Named bank" }]);
});
it("keeps inactive owner history and original reversal trace without exposing internal identity fields", async () => {
  const result = await ownerHistoryForActor(actor, id, {
    from: "2026-10-01",
    to: "2026-10-12",
    offset: 50,
    limit: 5,
  });
  expect(result.items[0]).toMatchObject({
    amount: "10.00",
    moneyAccountName: "Named bank",
    journalStatus: "REVERSED",
    reversal: { date: "2026-10-11", reason: "Correction" },
  });
  expect(result.hasMore).toBe(true);
  const query = calls.rows.mock.calls[0][0];
  expect(query.where).toMatchObject({
    companyId: "company",
    ownerFinancialAccountId: id,
    branchId: { in: ["branch"] },
    transactionDate: {
      gte: new Date("2026-10-01"),
      lte: new Date("2026-10-12"),
    },
  });
  expect(query.skip).toBe(50);
  expect(query.take).toBe(5);
  expect(calls.owner.mock.calls[0][0].select).not.toHaveProperty(
    "creationInputHash",
  );
  expect(calls.journals.mock.calls[0][0].where.companyId).toBe("company");
  expect(calls.accounts.mock.calls[0][0].where.companyId).toBe("company");
});
it("denies a missing or foreign-company owner before reading transactions", async () => {
  calls.owner.mockResolvedValue(null);
  await expect(ownerHistoryForActor(actor, id)).rejects.toThrow();
  expect(calls.rows).not.toHaveBeenCalled();
});
it("denies roles without money-view access before reading identities", async () => {
  await expect(
    ownerHistoryForActor({ ...actor, accountRole: "PROJECT_MANAGER" }, id),
  ).rejects.toThrow();
  expect(calls.owner).not.toHaveBeenCalled();
});
it("rejects invalid ranges and unbounded paging before reading data", async () => {
  await expect(
    ownerHistoryForActor(actor, id, { from: "2026-10-12", to: "2026-10-01" }),
  ).rejects.toThrow("INVALID_DATE_RANGE");
  await expect(
    ownerHistoryForActor(actor, id, { limit: 101 }),
  ).rejects.toThrow();
  expect(calls.rows).not.toHaveBeenCalled();
});
it("uses an empty assigned branch list without broadening access", async () => {
  await ownerHistoryForActor({ ...actor, branchIds: [] }, id);
  expect(calls.rows.mock.calls[0][0].where.branchId).toEqual({ in: [] });
});

it("rejects nonexistent calendar days rather than normalizing them", async () => {
  await expect(
    ownerHistoryForActor(actor, id, { from: "2026-02-31" }),
  ).rejects.toThrow();
  expect(calls.owner).not.toHaveBeenCalled();
});
