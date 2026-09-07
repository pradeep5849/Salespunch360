import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { deactivateEmployeeInTransaction, resetEmployeePasswordInTransaction } from "./service";

function transaction(employee: { id: string; companyId: string; role: "MANAGER" | "SALES"; isActive: boolean }) {
  return {
    user: { findUnique: vi.fn().mockResolvedValue(employee), findFirst: vi.fn().mockResolvedValue(employee), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $queryRaw: vi.fn().mockResolvedValue([{ id: employee.id }]),
    pushDevice: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    mobileSession: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
  };
}

describe("employee security mutations", () => {
  it("deactivation soft-disables the employee and revokes every session", async () => {
    const mock = transaction({ id: "employee", companyId: "company-a", role: "SALES", isActive: true });
    await deactivateEmployeeInTransaction(mock as unknown as Prisma.TransactionClient, "company-a", "employee");
    expect(mock.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false, salesAccessActive: false, accountAccessActive: false } }));
    expect(mock.user.updateMany.mock.calls[0][0].data).not.toHaveProperty("salesRole");
    expect(mock.user.updateMany.mock.calls[0][0].data).not.toHaveProperty("accountRole");
    expect(mock.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "employee" } });
    expect(mock.mobileSession.deleteMany).toHaveBeenCalledWith({ where: { userId: "employee" } });
  });

  it("rejects a cross-company password reset before mutation", async () => {
    const mock = transaction({ id: "employee", companyId: "company-b", role: "SALES", isActive: true });
    await expect(resetEmployeePasswordInTransaction(mock as unknown as Prisma.TransactionClient, "company-a", "employee", "hash")).rejects.toThrow("NOT_FOUND");
    expect(mock.user.updateMany).not.toHaveBeenCalled();
    expect(mock.session.deleteMany).not.toHaveBeenCalled();
    expect(mock.mobileSession.deleteMany).not.toHaveBeenCalled();
  });

  it("password reset updates the hash and revokes employee sessions", async () => {
    const mock = transaction({ id: "employee", companyId: "company-a", role: "MANAGER", isActive: true });
    await resetEmployeePasswordInTransaction(mock as unknown as Prisma.TransactionClient, "company-a", "employee", "new-hash");
    expect(mock.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { passwordHash: "new-hash", sessionVersion: { increment: 1 } } }));
    expect(mock.pushDevice.deleteMany).toHaveBeenCalledWith({ where: { userId: "employee" } });
    expect(mock.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "employee" } });
    expect(mock.mobileSession.deleteMany).toHaveBeenCalledWith({ where: { userId: "employee" } });
  });
});
