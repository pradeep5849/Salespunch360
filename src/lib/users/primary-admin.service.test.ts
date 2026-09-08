import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutation: vi.fn(), read: vi.fn(), transaction: vi.fn(), candidates: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({ requirePermissionForMutation: mocks.mutation, requirePermission: mocks.read }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction, user: { findMany: mocks.candidates } } }));

import { listPrimaryAdminTransferCandidates, transferPrimaryAdmin } from "./primary-admin";

const companyId = "1d8b93fd-eed3-48f0-b117-047574625ada";
const actorId = "0202cd71-0a78-44c8-86a2-dcee7e899209";
const targetId = "4f0ef50d-d8a6-4b31-8d8d-cb87c1c6ed60";
const actor = { id: actorId, companyId, role: "COMPANY_ADMIN", salesRole: "PRIMARY_ADMIN", isActive: true, salesAccessActive: true };
const target = { id: targetId, companyId, role: "FIELD_ADMIN", salesRole: "ADMIN", isActive: true, salesAccessActive: true };

function transaction(options: { primaries?: { id: string }[]; target?: typeof target | null; demoted?: number; promoted?: number; resulting?: { id: string }[] } = {}) {
  let primaryReads = 0;
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ locked: 1 }]),
    user: {
      findFirst: vi.fn().mockResolvedValueOnce(actor).mockResolvedValueOnce(options.target === undefined ? target : options.target),
      findMany: vi.fn().mockImplementation(() => Promise.resolve(primaryReads++ === 0 ? (options.primaries ?? [{ id: actorId }]) : (options.resulting ?? [{ id: targetId }]))),
      updateMany: vi.fn().mockResolvedValueOnce({ count: options.demoted ?? 1 }).mockResolvedValueOnce({ count: options.promoted ?? 1 }),
    },
  };
  mocks.transaction.mockImplementationOnce(async (callback, config) => {
    expect(config).toEqual({ isolationLevel: "Serializable" });
    return callback(tx);
  });
  return tx;
}

describe("Primary Admin transfer service", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.mutation.mockResolvedValue(actor); mocks.read.mockResolvedValue(actor); });

  it("serializes, re-authorizes, projects both legacy roles, and preserves every unrelated field", async () => {
    const tx = transaction();
    await expect(transferPrimaryAdmin({ targetUserId: targetId })).resolves.toEqual({ primaryAdminId: targetId });
    expect(mocks.mutation).toHaveBeenCalledWith("SALES_USER_ADMIN");
    expect(tx.$queryRaw).toHaveBeenCalledBefore(tx.user.findFirst);
    expect(tx.user.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: actorId, companyId, salesRole: "PRIMARY_ADMIN", isActive: true, salesAccessActive: true },
      data: { salesRole: "ADMIN", role: "FIELD_ADMIN" },
    });
    expect(tx.user.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: targetId, companyId, salesRole: "ADMIN", isActive: true, salesAccessActive: true },
      data: { salesRole: "PRIMARY_ADMIN", role: "COMPANY_ADMIN" },
    });
    for (const call of tx.user.updateMany.mock.calls) {
      for (const preserved of ["isActive", "salesAccessActive", "accountRole", "accountAccessActive", "managerId", "managerType", "branchAccessScope"]) {
        expect(call[0].data).not.toHaveProperty(preserved);
      }
    }
  });

  it.each([[[]], [[{ id: actorId }, { id: "another" }]], [[{ id: targetId }]]])("fails closed for malformed or actor-mismatched Primary state", async (primaries) => {
    const tx = transaction({ primaries: primaries as { id: string }[] });
    await expect(transferPrimaryAdmin({ targetUserId: targetId })).rejects.toThrow("PRIMARY_ADMIN_INVARIANT");
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it("fails closed and rolls the transaction back when either conditional write or final invariant fails", async () => {
    const demotion = transaction({ demoted: 0 });
    await expect(transferPrimaryAdmin({ targetUserId: targetId })).rejects.toThrow("PRIMARY_ADMIN_INVARIANT");
    expect(demotion.user.updateMany).toHaveBeenCalledTimes(1);
    const promotion = transaction({ promoted: 0 });
    await expect(transferPrimaryAdmin({ targetUserId: targetId })).rejects.toThrow("INVALID_TRANSFER_TARGET");
    expect(promotion.user.updateMany).toHaveBeenCalledTimes(2);
    const final = transaction({ resulting: [] });
    await expect(transferPrimaryAdmin({ targetUserId: targetId })).rejects.toThrow("PRIMARY_ADMIN_INVARIANT");
    expect(final.user.updateMany).toHaveBeenCalledTimes(2);
  });

  it("a competing stale actor is rejected after acquiring the company lock", async () => {
    const stale = { ...actor, salesRole: "ADMIN", role: "FIELD_ADMIN" };
    const tx = transaction();
    tx.user.findFirst.mockReset().mockResolvedValueOnce(stale);
    await expect(transferPrimaryAdmin({ targetUserId: targetId })).rejects.toThrow("NOT_AUTHORIZED");
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it("returns only minimal eligible candidate fields through a tenant-scoped canonical query", async () => {
    mocks.candidates.mockResolvedValue([{ id: targetId, name: "New Admin", email: "new@example.com" }]);
    await expect(listPrimaryAdminTransferCandidates()).resolves.toHaveLength(1);
    expect(mocks.read).toHaveBeenCalledWith("SALES_USER_ADMIN");
    expect(mocks.candidates).toHaveBeenCalledWith({
      where: { companyId, id: { not: actorId }, isActive: true, salesAccessActive: true, salesRole: "ADMIN" },
      select: { id: true, name: true, email: true }, orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  });
});
