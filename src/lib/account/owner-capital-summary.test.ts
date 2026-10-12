import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const calls = vi.hoisted(() => ({ owners: vi.fn(), aggregate: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    ownerFinancialAccount: { findMany: calls.owners },
    journalLine: { aggregate: calls.aggregate },
  },
}));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
}));
import { ownerCapitalSummaryForActor } from "./owner-capital-summary";
import type { ProjectActor } from "./projects";
const actor = {
  companyId: "company",
  accountRole: "ACCOUNTANT",
  isActive: true,
  accountAccessActive: true,
  branchAccessScope: "SELECTED_BRANCHES",
  branchIds: ["branch"],
} as ProjectActor;
beforeEach(() => {
  vi.clearAllMocks();
  calls.owners.mockResolvedValue([{ capitalLedgerId: "capital" }]);
  calls.aggregate.mockResolvedValue({
    _sum: {
      credit: new Prisma.Decimal("100"),
      debit: new Prisma.Decimal("10"),
    },
  });
});
it("returns only owner capital without adding drawings or asset value and retains branch/company scope", async () => {
  expect(await ownerCapitalSummaryForActor(actor)).toEqual({
    ownerCount: 1,
    capital: "90.00",
  });
  expect(calls.owners).toHaveBeenCalledWith({
    where: { companyId: "company" },
    select: { capitalLedgerId: true },
  });
  expect(calls.aggregate.mock.calls[0][0].where).toEqual({
    companyId: "company",
    ledgerAccountId: { in: ["capital"] },
    journalEntry: {
      status: { in: ["POSTED", "REVERSED"] },
      branchId: { in: ["branch"] },
    },
  });
});
it("returns zero for no owners and null ledger sums", async () => {
  calls.owners.mockResolvedValue([]);
  calls.aggregate.mockResolvedValue({ _sum: { credit: null, debit: null } });
  expect(await ownerCapitalSummaryForActor(actor)).toEqual({
    ownerCount: 0,
    capital: "0.00",
  });
});
it("rejects money-view denied roles before reading financing balances", async () => {
  await expect(
    ownerCapitalSummaryForActor({ ...actor, accountRole: "PROJECT_MANAGER" }),
  ).rejects.toThrow();
  expect(calls.owners).not.toHaveBeenCalled();
});
it("an empty assigned branch set cannot broaden to all-company balances", async () => {
  await ownerCapitalSummaryForActor({ ...actor, branchIds: [] });
  expect(calls.aggregate.mock.calls[0][0].where.journalEntry.branchId).toEqual({
    in: [],
  });
});
