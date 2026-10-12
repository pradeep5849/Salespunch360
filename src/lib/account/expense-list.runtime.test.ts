import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  rows: vi.fn(),
  count: vi.fn(),
  summary: vi.fn(),
  transaction: vi.fn(),
  branches: vi.fn(),
  projects: vi.fn(),
  module: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    expenseTransaction: { findMany: m.rows, count: m.count },
    project: { findMany: m.projects },
    $transaction: m.transaction,
    $queryRaw: m.summary,
  },
}));
vi.mock("@/lib/account/projects", () => ({
  authorizedProjectBranchIds: m.branches,
  projectRecordScope: () => ({ companyId: "tenant" }),
}));
vi.mock("@/lib/account/modules", () => ({ requireAccountModules: m.module }));
import { expensePageForActor, expenseSummaryForActor } from "./expenses";
import type { ProjectActor } from "./projects";
const branch = "00000000-0000-4000-8000-000000000001";
const actor = {
  id: "user",
  companyId: "tenant",
  accountRole: "ACCOUNT_ADMIN",
  branchAccessScope: "SELECTED_BRANCHES",
  branchIds: [branch],
} as ProjectActor;
describe("A052 scoped database pagination", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.branches.mockResolvedValue([branch]);
    m.module.mockResolvedValue(undefined);
    m.rows.mockResolvedValue([{ id: "row" }]);
    m.count.mockResolvedValue(205);
    m.summary.mockResolvedValue([]);
    m.transaction.mockImplementation((queries) => Promise.all(queries));
    m.projects.mockResolvedValue([{ id: "assigned" }]);
  });
  it("applies search/type/status/category before stable bounded pagination", async () => {
    const category = "00000000-0000-4000-8000-000000000002";
    const result = await expensePageForActor(actor, {
      q: " old-search-target ",
      status: "POSTED",
      type: "OFFICE_EXPENSE",
      categoryId: category,
      branchId: branch,
      offset: 200,
      limit: 50,
    });
    expect(m.rows).toHaveBeenCalledWith({
      where: {
        AND: [
          { companyId: "tenant", branchId: { in: [branch] } },
          {
            branchId: branch,
            status: "POSTED",
            type: "OFFICE_EXPENSE",
            categoryId: category,
            OR: [
              {
                transactionNumber: {
                  contains: "old-search-target",
                  mode: "insensitive",
                },
              },
              {
                reference: {
                  contains: "old-search-target",
                  mode: "insensitive",
                },
              },
            ],
          },
        ],
      },
      orderBy: [
        { transactionDate: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: 200,
      take: 50,
    });
    expect(m.count.mock.calls[0][0].where).toEqual(
      m.rows.mock.calls[0][0].where,
    );
    expect(result).toMatchObject({ total: 205, offset: 200, nextOffset: 201 });
    expect(m.transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: "RepeatableRead",
    });
  });
  it("provides a terminal page without a false continuation", async () => {
    m.rows.mockResolvedValue(Array.from({ length: 5 }, (_, id) => ({ id })));
    expect(
      (await expensePageForActor(actor, { offset: 200 })).nextOffset,
    ).toBeNull();
  });
  it("rejects inaccessible branch without querying transactions", async () => {
    await expect(
      expensePageForActor(actor, {
        branchId: "00000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toThrow();
    expect(m.rows).not.toHaveBeenCalled();
  });
  it.each([
    { status: "WRONG" },
    { type: "WRONG" },
    { offset: -1 },
    { limit: 201 },
  ])("rejects invalid common filters %j", async (query) => {
    await expect(expensePageForActor(actor, query)).rejects.toThrow();
    expect(m.rows).not.toHaveBeenCalled();
  });
  it("denies a role without expense view permission", async () => {
    await expect(
      expensePageForActor({ ...actor, accountRole: "DATA_ENTRY" }),
    ).rejects.toThrow();
    expect(m.rows).not.toHaveBeenCalled();
  });
  it("preserves assigned Project Manager records and Projects module enforcement", async () => {
    const projectActor = { ...actor, accountRole: "PROJECT_MANAGER" as const };
    await expensePageForActor(projectActor);
    expect(m.module).toHaveBeenCalledWith(projectActor, "PROJECTS");
    expect(m.rows.mock.calls[0][0].where.AND[0]).toMatchObject({
      companyId: "tenant",
      type: { in: ["PROJECT_EXPENSE", "REIMBURSEMENT"] },
      projectId: { in: ["assigned"] },
    });
  });
  it("returns summary totals for all matching records, independently of pagination", async () => {
    m.summary.mockResolvedValue([
      {
        categoryId: "category",
        categoryName: "Inactive",
        isActive: false,
        expense: "12.34",
        income: "0.00",
      },
    ]);
    const result = await expensePageForActor(actor, { offset: 200 });
    expect(result.summary).toMatchObject({
      expense: "12.34",
      income: "0.00",
      categories: [{ isActive: false }],
    });
    const sql = m.summary.mock.calls[0][0];
    expect(sql.values).toContain("tenant");
    expect(sql.values).toContain(branch);
    expect(sql.text).not.toMatch(/LIMIT|OFFSET/);
  });
  it("denies aggregate access when the Expenses module is OFF before any raw read", async () => {
    m.module.mockRejectedValue(new Error("MODULE_DISABLED:EXPENSES"));
    await expect(expenseSummaryForActor(actor)).rejects.toThrow(
      "MODULE_DISABLED:EXPENSES",
    );
    expect(m.summary).not.toHaveBeenCalled();
  });
  it("denies inaccessible branch and unauthorized role on standalone category aggregate", async () => {
    await expect(
      expenseSummaryForActor(actor, {
        branchId: "00000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toThrow();
    await expect(
      expenseSummaryForActor({ ...actor, accountRole: "DATA_ENTRY" }),
    ).rejects.toThrow();
    expect(m.summary).not.toHaveBeenCalled();
  });
});
