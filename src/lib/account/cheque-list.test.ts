import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  rows: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
  branch: vi.fn(),
  accounts: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    cheque: { findMany: m.rows, count: m.count },
    branch: { findFirst: m.branch },
    moneyAccount: { findMany: m.accounts },
    $transaction: m.transaction,
  },
}));
import { chequePageForActor } from "./cheque-list";
import type { ProjectActor } from "./projects";
const branch = "00000000-0000-4000-8000-000000000001";
const actor = {
  id: "user",
  companyId: "tenant",
  role: "ACCOUNT_USER",
  accountRole: "ACCOUNT_ADMIN",
  accountAccessActive: true,
  salesAccessActive: false,
  isActive: true,
  branchAccessScope: "SELECTED_BRANCHES",
  branchIds: [branch],
} as ProjectActor;
describe("A066 authorized bounded cheque read", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.rows.mockResolvedValue([{ id: "row", moneyAccountId: "bank" }]);
    m.count.mockResolvedValue(205);
    m.accounts.mockResolvedValue([
      { id: "bank", name: "Inactive historical bank", type: "BANK" },
    ]);
    m.branch.mockResolvedValue({ id: branch });
    m.transaction.mockImplementation((queries) => Promise.all(queries));
  });
  it("defaults to Open and returns stable bounded paging with company-owned account metadata", async () => {
    const result = await chequePageForActor(actor);
    const args = m.rows.mock.calls[0][0];
    expect(args).toMatchObject({
      where: {
        AND: [
          { companyId: "tenant", branchId: { in: [branch] } },
          { status: { in: ["ISSUED", "RECEIVED"] } },
        ],
      },
      skip: 0,
      take: 25,
      orderBy: [{ chequeDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
    expect(m.count).toHaveBeenCalledWith({ where: args.where });
    expect(m.transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: "RepeatableRead",
    });
    expect(m.accounts).toHaveBeenCalledWith({
      where: { companyId: "tenant", id: { in: ["bank"] } },
      select: { id: true, name: true, type: true },
    });
    expect(result).toMatchObject({
      total: 205,
      nextOffset: 1,
      rows: [{ moneyAccount: { name: "Inactive historical bank" } }],
    });
  });
  it("filters search, selected branch and closed statuses before pagination and respects date order", async () => {
    await chequePageForActor(actor, {
      branchId: branch,
      tab: "CLOSED",
      q: " older reference ",
      order: "asc",
      offset: 200,
      limit: 5,
    });
    const args = m.rows.mock.calls[0][0];
    expect(args).toMatchObject({
      skip: 200,
      take: 5,
      orderBy: [{ chequeDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    expect(args.where.AND[1]).toMatchObject({
      branchId: branch,
      status: { in: ["DEPOSITED", "CLEARED", "BOUNCED", "CANCELLED"] },
      OR: expect.arrayContaining([
        { reference: { contains: "older reference", mode: "insensitive" } },
      ]),
    });
  });
  it("returns All without a tab predicate and ends pagination correctly", async () => {
    m.count.mockResolvedValue(1);
    const result = await chequePageForActor(actor, { tab: "ALL" });
    expect(m.rows.mock.calls[0][0].where.AND[1]).not.toHaveProperty("status");
    expect(result.nextOffset).toBeNull();
  });
  it("rejects foreign or inactive selected branches before reading cheques", async () => {
    await expect(
      chequePageForActor(actor, {
        branchId: "00000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toThrow();
    expect(m.branch).not.toHaveBeenCalled();
    m.branch.mockResolvedValue(null);
    await expect(
      chequePageForActor(actor, { branchId: branch }),
    ).rejects.toThrow();
    expect(m.rows).not.toHaveBeenCalled();
  });
  it("rejects unauthorized roles and missing company", async () => {
    await expect(
      chequePageForActor({ ...actor, accountRole: "PROJECT_MANAGER" }),
    ).rejects.toThrow();
    await expect(
      chequePageForActor({ ...actor, companyId: null } as ProjectActor),
    ).rejects.toThrow();
    expect(m.rows).not.toHaveBeenCalled();
  });
  it.each([
    { tab: "UNKNOWN" },
    { status: "OPEN" },
    { order: "party" },
    { offset: -1 },
    { limit: 101 },
  ])("rejects invalid bounded filters %j", async (query) => {
    await expect(chequePageForActor(actor, query)).rejects.toThrow();
    expect(m.rows).not.toHaveBeenCalled();
  });
});
