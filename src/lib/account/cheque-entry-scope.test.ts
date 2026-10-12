import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectActor } from "./projects";
const m = vi.hoisted(() => ({
  branch: vi.fn(),
  customers: vi.fn(),
  vendors: vi.fn(),
  accounts: vi.fn(),
  context: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    branch: { findFirst: m.branch },
    customer: { findMany: m.customers },
    vendor: { findMany: m.vendors },
    moneyAccount: { findMany: m.accounts },
  },
}));
vi.mock("./branch-context", () => ({ resolveAccountBranchContext: m.context }));
import { searchChequePartiesForActor } from "./cheque-parties";
import { chequeEntryOptionsForActor } from "./cheque-entry-options";
const branch = "00000000-0000-4000-8000-000000000001",
  foreign = "00000000-0000-4000-8000-000000000002";
const actor = {
  id: "actor",
  companyId: "tenant",
  role: "ACCOUNT_USER",
  accountRole: "ACCOUNT_ADMIN",
  isActive: true,
  accountAccessActive: true,
  salesAccessActive: false,
  branchAccessScope: "SELECTED_BRANCHES",
  branchIds: [branch],
} as ProjectActor;
describe("scoped and paged cheque entry choices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.branch.mockResolvedValue({ id: branch });
    m.customers.mockResolvedValue(
      Array.from({ length: 26 }, (_, i) => ({
        id: `party-${i}`,
        name: `Customer ${i}`,
      })),
    );
    m.vendors.mockResolvedValue([]);
    m.accounts.mockResolvedValue(
      Array.from({ length: 26 }, (_, i) => ({
        id: `bank-${i}`,
        name: `Bank ${i}`,
        type: "BANK",
      })),
    );
    m.context.mockResolvedValue({
      context: { mode: "BRANCH", branchId: branch },
      branches: [{ id: branch, name: "Allowed" }],
    });
  });
  it("searches company account customers in the authorized branch beyond the first page", async () => {
    const result = await searchChequePartiesForActor(actor, {
      branchId: branch,
      direction: "RECEIVED",
      q: "  Customer  ",
      offset: "200",
    });
    expect(m.customers).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "tenant",
          branchId: branch,
          isActive: true,
          isAccountCustomer: true,
          name: { contains: "Customer", mode: "insensitive" },
        },
        skip: 200,
        take: 26,
        select: { id: true, name: true },
      }),
    );
    expect(result.rows).toHaveLength(25);
    expect(result.hasMore).toBe(true);
  });
  it("denies foreign, inactive and unauthorized branch choices before party reads", async () => {
    await expect(
      searchChequePartiesForActor(actor, {
        branchId: foreign,
        direction: "RECEIVED",
      }),
    ).rejects.toThrow();
    expect(m.branch).not.toHaveBeenCalled();
    m.branch.mockResolvedValue(null);
    await expect(
      searchChequePartiesForActor(actor, {
        branchId: branch,
        direction: "RECEIVED",
      }),
    ).rejects.toThrow();
    expect(m.customers).not.toHaveBeenCalled();
    expect(m.vendors).not.toHaveBeenCalled();
  });
  it("keeps vendor choices in the company and filters bank-only entry choices with stable paging", async () => {
    await searchChequePartiesForActor(actor, {
      branchId: branch,
      direction: "ISSUED",
    });
    expect(m.vendors.mock.calls[0][0].where).toMatchObject({
      companyId: "tenant",
      isActive: true,
    });
    const result = await chequeEntryOptionsForActor(actor, {
      branchId: branch,
      kind: "BANK",
      offset: "25",
    });
    expect(m.accounts.mock.calls[0][0]).toMatchObject({
      where: {
        companyId: "tenant",
        isActive: true,
        type: "BANK",
        OR: [{ branchId: null }, { branchId: branch }],
      },
      skip: 25,
      take: 26,
    });
    expect(result.accounts).toHaveLength(25);
    expect(result.hasMore).toBe(true);
  });
  it.each(["DATA_ENTRY", "PROJECT_MANAGER"] as const)(
    "denies %s entry choices before database reads",
    async (accountRole) => {
      await expect(
        searchChequePartiesForActor(
          { ...actor, accountRole },
          { branchId: branch, direction: "RECEIVED" },
        ),
      ).rejects.toThrow();
      await expect(
        chequeEntryOptionsForActor({ ...actor, accountRole }, {}),
      ).rejects.toThrow();
      expect(m.branch).not.toHaveBeenCalled();
      expect(m.context).not.toHaveBeenCalled();
      expect(m.accounts).not.toHaveBeenCalled();
    },
  );
});
