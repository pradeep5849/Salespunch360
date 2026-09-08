import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePermissionForMutation: vi.fn(),
  branchFindMany: vi.fn(),
  userFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requirePermission: mocks.requirePermission,
  requirePermissionForMutation: mocks.requirePermissionForMutation,
}));
vi.mock("@/lib/db", () => ({ db: {
  branch: { findMany: mocks.branchFindMany },
  user: { findFirst: mocks.userFindFirst },
  $transaction: mocks.transaction,
} }));

import { getEmployeeBranchAssignment, listBranchAssignmentOptions, replaceBranchAssignment, setEmployeeBranchAssignment } from "./assignment";

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const employeeId = "11111111-1111-4111-8111-111111111111";
const branchOne = "22222222-2222-4222-8222-222222222222";
const branchTwo = "33333333-3333-4333-8333-333333333333";
const actor = { id: "admin", companyId, role: "COMPANY_ADMIN", salesRole: "ADMIN" };

function transactionTarget(overrides: Record<string, unknown> = {}) {
  const target = { id: employeeId, companyId, salesRole: "SALES", role: "SALES", ...overrides };
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ locked: 1 }]),
    user: {
      findFirst: vi.fn().mockResolvedValue(target),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({ branchAccessScope: "SELECTED_BRANCHES" }),
    },
    branch: { findMany: vi.fn().mockResolvedValue([{ id: branchOne }, { id: branchTwo }]) },
    userBranchAccess: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      findMany: vi.fn().mockResolvedValue([{ branchId: branchOne }, { branchId: branchTwo }]),
    },
  };
}

describe("public branch assignment authorization and reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(actor);
    mocks.requirePermissionForMutation.mockResolvedValue(actor);
  });

  it("lists only active tenant options with a minimal deterministic query", async () => {
    mocks.branchFindMany.mockResolvedValue([]);
    await listBranchAssignmentOptions();
    expect(mocks.requirePermission).toHaveBeenCalledWith("SALES_USER_ADMIN");
    expect(mocks.branchFindMany).toHaveBeenCalledWith({
      where: { companyId, isActive: true },
      select: { id: true, name: true, code: true, isPrimary: true },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }, { id: "asc" }],
    });
  });

  it("reads canonical employee assignments without lifecycle filtering and retains inactive branches", async () => {
    mocks.userFindFirst.mockResolvedValue({
      id: employeeId, companyId, salesRole: "MANAGER", role: "MANAGER", branchAccessScope: "SELECTED_BRANCHES",
      branchAccesses: [{ branch: { id: branchOne, name: "Old", code: "OLD", isPrimary: false, isActive: false } }],
    });
    await expect(getEmployeeBranchAssignment(employeeId)).resolves.toEqual({
      userId: employeeId, branchAccessScope: "SELECTED_BRANCHES",
      branches: [{ id: branchOne, name: "Old", code: "OLD", isPrimary: false, isActive: false }],
    });
    expect(mocks.requirePermission).toHaveBeenCalledWith("SALES_USER_ADMIN");
    const query = mocks.userFindFirst.mock.calls[0][0];
    expect(query.where).toEqual({ id: employeeId, companyId, salesRole: { in: ["MANAGER", "SALES"] } });
    expect(query.where).not.toHaveProperty("salesAccessActive");
    expect(query.where).not.toHaveProperty("isActive");
  });

  it("rejects noncanonical and cross-company targets without disclosing them", async () => {
    for (const target of [null, { id: employeeId, companyId: "other", salesRole: "SALES", role: "SALES", branchAccesses: [] }, { id: employeeId, companyId, salesRole: null, role: "MANAGER", branchAccesses: [] }, { id: employeeId, companyId, salesRole: "ADMIN", role: "COMPANY_ADMIN", branchAccesses: [] }]) {
      mocks.userFindFirst.mockResolvedValueOnce(target);
      await expect(getEmployeeBranchAssignment(employeeId)).rejects.toThrow("NOT_FOUND");
    }
  });

  it("uses mutation-safe authorization before parsing or database work", async () => {
    mocks.requirePermissionForMutation.mockRejectedValue(new Error("denied"));
    await expect(setEmployeeBranchAssignment({ employeeId: "bad", branchAccessScope: "ALL_BRANCHES" })).rejects.toThrow("denied");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.requirePermissionForMutation).toHaveBeenCalledWith("SALES_USER_ADMIN");
  });
});

describe("atomic replacement", () => {
  it("locks and re-reads an inactive or Sales-suspended canonical target before replacing the exact selected set", async () => {
    const tx = transactionTarget({ isActive: false, salesAccessActive: false });
    await replaceBranchAssignment(tx as unknown as Prisma.TransactionClient, companyId, { employeeId, branchAccessScope: "SELECTED_BRANCHES", branchIds: [branchOne, branchTwo] });
    expect(tx.$queryRaw).toHaveBeenCalledBefore(tx.user.findFirst);
    const [sql, lockedEmployeeId, lockedCompanyId] = tx.$queryRaw.mock.calls[0];
    expect(Array.from(sql).join("?")).toMatch(/WHERE "id" = \?::uuid\s+AND "companyId" = \?::uuid\s+FOR UPDATE/);
    expect([lockedEmployeeId, lockedCompanyId]).toEqual([employeeId, companyId]);
    expect(tx.branch.findMany).toHaveBeenCalledWith({ where: { id: { in: [branchOne, branchTwo] }, companyId, isActive: true }, select: { id: true } });
    expect(tx.userBranchAccess.deleteMany).toHaveBeenCalledBefore(tx.userBranchAccess.createMany);
    expect(tx.userBranchAccess.createMany).toHaveBeenCalledWith({ data: [{ userId: employeeId, branchId: branchOne }, { userId: employeeId, branchId: branchTwo }] });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: employeeId }, data: { branchAccessScope: "SELECTED_BRANCHES" } });
  });

  it("fails closed for cross-company, inactive, nonexistent, or mixed branch sets before replacement", async () => {
    const tx = transactionTarget();
    tx.branch.findMany.mockResolvedValue([{ id: branchOne }]);
    await expect(replaceBranchAssignment(tx as unknown as Prisma.TransactionClient, companyId, { employeeId, branchAccessScope: "SELECTED_BRANCHES", branchIds: [branchOne, branchTwo] })).rejects.toThrow("INVALID_BRANCH");
    expect(tx.userBranchAccess.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("canonicalizes ALL_BRANCHES by deleting every row and verifies zero remain", async () => {
    const tx = transactionTarget();
    tx.user.findUnique.mockResolvedValue({ branchAccessScope: "ALL_BRANCHES" });
    tx.userBranchAccess.findMany.mockResolvedValue([]);
    await replaceBranchAssignment(tx as unknown as Prisma.TransactionClient, companyId, { employeeId, branchAccessScope: "ALL_BRANCHES" });
    expect(tx.branch.findMany).not.toHaveBeenCalled();
    expect(tx.userBranchAccess.deleteMany).toHaveBeenCalledWith({ where: { userId: employeeId } });
    expect(tx.userBranchAccess.createMany).not.toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: employeeId }, data: { branchAccessScope: "ALL_BRANCHES" } });
  });

  it("throws to roll back if scope, count, or exact membership verification fails", async () => {
    const tx = transactionTarget();
    tx.userBranchAccess.findMany.mockResolvedValue([{ branchId: branchOne }, { branchId: "44444444-4444-4444-8444-444444444444" }]);
    await expect(replaceBranchAssignment(tx as unknown as Prisma.TransactionClient, companyId, { employeeId, branchAccessScope: "SELECTED_BRANCHES", branchIds: [branchOne, branchTwo] })).rejects.toThrow("INVARIANT_VIOLATION");
  });

  it.each([["MANAGER", "MANAGER"], ["SALES", "SALES"]] as const)("allows canonical %s targets with an ordinary compatible legacy role", async (salesRole, role) => {
    const tx = transactionTarget({ salesRole, role });
    await expect(replaceBranchAssignment(tx as unknown as Prisma.TransactionClient, companyId, { employeeId, branchAccessScope: "SELECTED_BRANCHES", branchIds: [branchOne, branchTwo] })).resolves.toMatchObject({ userId: employeeId });
    expect(tx.user.update.mock.calls[0][0].data).toEqual({ branchAccessScope: "SELECTED_BRANCHES" });
  });

  it.each(["MANAGER", "SALES"] as const)("rejects canonical %s when legacy role is SUPER_ADMIN before replacement writes", async (salesRole) => {
    const tx = transactionTarget({ salesRole, role: "SUPER_ADMIN" });
    await expect(replaceBranchAssignment(tx as unknown as Prisma.TransactionClient, companyId, { employeeId, branchAccessScope: "ALL_BRANCHES" })).rejects.toThrow("NOT_FOUND");
    expect(tx.userBranchAccess.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it.each([[null, "MANAGER"], [null, "SALES"]] as const)("rejects salesRole %s even when legacy role is %s", async (salesRole, role) => {
    const tx = transactionTarget({ salesRole, role });
    await expect(replaceBranchAssignment(tx as unknown as Prisma.TransactionClient, companyId, { employeeId, branchAccessScope: "ALL_BRANCHES" })).rejects.toThrow("NOT_FOUND");
    expect(tx.userBranchAccess.deleteMany).not.toHaveBeenCalled();
  });

  it.each(["MANAGER", "SALES"] as const)("rejects canonical %s with legacy SUPER_ADMIN on the read path", async (salesRole) => {
    mocks.userFindFirst.mockResolvedValue({ id: employeeId, companyId, salesRole, role: "SUPER_ADMIN", branchAccessScope: "ALL_BRANCHES", branchAccesses: [] });
    await expect(getEmployeeBranchAssignment(employeeId)).rejects.toThrow("NOT_FOUND");
  });

  it.each([null, "PRIMARY_ADMIN", "ADMIN"])("rejects canonical target role %s", async (salesRole) => {
    const tx = transactionTarget({ salesRole });
    await expect(replaceBranchAssignment(tx as unknown as Prisma.TransactionClient, companyId, { employeeId, branchAccessScope: "ALL_BRANCHES" })).rejects.toThrow("NOT_FOUND");
    expect(tx.userBranchAccess.deleteMany).not.toHaveBeenCalled();
  });
});
