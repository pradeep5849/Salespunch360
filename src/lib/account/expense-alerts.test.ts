import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { ProjectActor } from "./projects";
const mock = vi.hoisted(() => ({
  branch: vi.fn(),
  modules: vi.fn(),
  scope: vi.fn(),
  count: vi.fn(),
  list: vi.fn(),
}));
vi.mock("./branch-context", () => ({
  resolveAccountBranchContext: mock.branch,
}));
vi.mock("./modules", () => ({ enabledModulesForCompany: mock.modules }));
vi.mock("./expenses", () => ({ expenseRecordScope: mock.scope }));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({ expenseTransaction: { count: mock.count, findMany: mock.list } }),
  },
}));
import { pendingExpenseAlertsForActor } from "./expense-alerts";
const branchId = "22222222-2222-4222-8222-222222222222";
const actor = {
  id: "actor",
  name: "Actor",
  email: "actor@example.test",
  managerType: null,
  salesRole: null,
  salesAccessActive: false,
  companyId: "11111111-1111-4111-8111-111111111111",
  role: "ACCOUNT_USER",
  isActive: true,
  accountAccessActive: true,
  accountRole: "ACCOUNT_ADMIN",
  branchAccessScope: "ALL_BRANCHES",
  branchIds: [],
} as ProjectActor;
describe("A070 expense alert authorization, scope and paging", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.branch.mockResolvedValue({
      context: { mode: "BRANCH", branchId, branchName: "Selected" },
    });
    mock.modules.mockResolvedValue(["EXPENSES", "PROJECTS"]);
    mock.scope.mockResolvedValue({ companyId: actor.companyId });
    mock.count.mockResolvedValue(101);
    mock.list.mockResolvedValue([
      { id: "expense", totalAmount: new Prisma.Decimal("12.34") },
    ]);
  });
  it("never queries expense data for dashboard-only Data Entry", async () => {
    const r = await pendingExpenseAlertsForActor(
      { ...actor, accountRole: "DATA_ENTRY" },
      { branchId },
    );
    expect(r.total).toBe(0);
    expect(mock.count).not.toHaveBeenCalled();
    expect(mock.list).not.toHaveBeenCalled();
    expect(mock.scope).not.toHaveBeenCalled();
  });
  it("suppresses unavailable Expenses and disabled Project Manager workflows", async () => {
    mock.modules.mockResolvedValueOnce([]);
    expect(
      (await pendingExpenseAlertsForActor(actor, { branchId })).total,
    ).toBe(0);
    mock.modules.mockResolvedValueOnce(["EXPENSES"]);
    expect(
      (
        await pendingExpenseAlertsForActor(
          { ...actor, accountRole: "PROJECT_MANAGER" },
          { branchId },
        )
      ).total,
    ).toBe(0);
    expect(mock.list).not.toHaveBeenCalled();
  });
  it("shares selected context between badge count and paginated rows, including posted review work", async () => {
    const r = await pendingExpenseAlertsForActor(actor, {
      branchId,
      offset: 50,
      limit: 50,
    });
    expect(r.total).toBe(101);
    expect(r.hasMore).toBe(true);
    expect(mock.scope).toHaveBeenCalledWith(actor);
    expect(mock.list).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { companyId: actor.companyId },
            { branchId },
            {
              OR: [
                { status: "PENDING_APPROVAL" },
                { status: "POSTED", approvalReviewStatus: "PENDING" },
              ],
            },
          ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 50,
        take: 50,
      }),
    );
    mock.list.mockClear();
    const badge = await pendingExpenseAlertsForActor(actor, { branchId }, true);
    expect(badge.total).toBe(r.total);
    expect(mock.list).not.toHaveBeenCalled();
  });
  it("rejects ambiguous scope, invalid paging and branch denial without financial reads", async () => {
    await expect(
      pendingExpenseAlertsForActor(actor, { branchId, scope: "all" }),
    ).rejects.toThrow();
    await expect(
      pendingExpenseAlertsForActor(actor, { limit: 101 }),
    ).rejects.toThrow();
    mock.branch.mockRejectedValueOnce(new Error("DENIED_BRANCH"));
    await expect(
      pendingExpenseAlertsForActor(actor, { branchId }),
    ).rejects.toThrow("DENIED_BRANCH");
    expect(mock.count).not.toHaveBeenCalled();
  });
});
