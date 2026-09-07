import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { activateAccountAccessInTransaction, activateSalesAccessInTransaction, deactivateIdentityInTransaction, suspendAccountAccessInTransaction, suspendSalesAccessInTransaction } from "./lifecycle";

const principal = (overrides = {}) => ({ id: "user", role: "MANAGER", salesRole: "MANAGER", accountRole: "PROJECT_MANAGER", isActive: true, companyId: "company", salesAccessActive: true, accountAccessActive: true, passwordHash: "hash", ...overrides });
function transaction(user = principal(), edition = "SALESPUNCH360_PLUS") {
  const update = vi.fn().mockResolvedValue(user);
  return { tx: { $queryRaw: vi.fn(), user: { findUnique: vi.fn().mockResolvedValue(user), update }, company: { findUnique: vi.fn().mockResolvedValue({ productEdition: edition }) }, pushDevice: { deleteMany: vi.fn() }, session: { deleteMany: vi.fn() }, mobileSession: { deleteMany: vi.fn() } } as unknown as Prisma.TransactionClient, update };
}

describe("canonical lifecycle security primitives", () => {
  it("globally deactivates without changing stable roles and revokes every credential", async () => {
    const { tx, update } = transaction();
    await deactivateIdentityInTransaction(tx, "user");
    expect(update).toHaveBeenNthCalledWith(1, { where: { id: "user" }, data: { isActive: false, salesAccessActive: false, accountAccessActive: false } });
    expect(update).toHaveBeenNthCalledWith(2, { where: { id: "user" }, data: { sessionVersion: { increment: 1 } } });
    expect(update.mock.calls[0][0].data).not.toHaveProperty("role");
    expect(update.mock.calls[0][0].data).not.toHaveProperty("salesRole");
    expect(update.mock.calls[0][0].data).not.toHaveProperty("accountRole");
    expect(tx.pushDevice.deleteMany).toHaveBeenCalledWith({ where: { userId: "user" } });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user" } });
    expect(tx.mobileSession.deleteMany).toHaveBeenCalledWith({ where: { userId: "user" } });
  });

  it.each([[suspendSalesAccessInTransaction, "salesAccessActive", "accountAccessActive"], [suspendAccountAccessInTransaction, "accountAccessActive", "salesAccessActive"]] as const)("suspends exactly one workspace and revokes authentication", async (suspend, changed, preserved) => {
    const { tx, update } = transaction(); await suspend(tx, "user");
    expect(update.mock.calls[0][0].data).toEqual({ [changed]: false });
    expect(update.mock.calls[0][0].data).not.toHaveProperty(preserved);
    expect(update.mock.calls[1][0].data).toEqual({ sessionVersion: { increment: 1 } });
  });

  it.each([
    [activateSalesAccessInTransaction, { salesRole: null }, "SALESPUNCH360_PLUS", "ROLE_REQUIRED"],
    [activateSalesAccessInTransaction, { isActive: false }, "SALESPUNCH360_PLUS", "IDENTITY_INACTIVE"],
    [activateSalesAccessInTransaction, {}, "SALESPUNCH360_ACCOUNT", "EDITION_NOT_ALLOWED"],
    [activateAccountAccessInTransaction, { accountRole: null }, "SALESPUNCH360_PLUS", "ROLE_REQUIRED"],
    [activateAccountAccessInTransaction, { isActive: false }, "SALESPUNCH360_PLUS", "IDENTITY_INACTIVE"],
    [activateAccountAccessInTransaction, {}, "SALESPUNCH360", "EDITION_NOT_ALLOWED"],
  ] as const)("rejects invalid activation", async (activate, override, edition, code) => {
    const { tx } = transaction(principal(override), edition); await expect(activate(tx, "user")).rejects.toThrow(code);
  });

  it.each([[activateSalesAccessInTransaction, "salesAccessActive", "accountAccessActive"], [activateAccountAccessInTransaction, "accountAccessActive", "salesAccessActive"]] as const)("reactivates exactly one PLUS workspace", async (activate, changed, preserved) => {
    const { tx, update } = transaction(); await activate(tx, "user");
    expect(update.mock.calls[0][0].data).toEqual({ [changed]: true });
    expect(update.mock.calls[0][0].data).not.toHaveProperty(preserved);
  });
});
