import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { deactivateEmployeeInTransaction, resetEmployeePasswordInTransaction } from "./service";

function transaction(employee: { id: string; companyId: string; role: "MANAGER" | "SALES"; isActive: boolean }) {
  return {
    user: { findFirst: vi.fn().mockResolvedValue(employee), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    mobileSession: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
  };
}

describe("employee security mutations", () => {
  it("deactivation soft-disables the employee and revokes every session", async () => {
    const mock = transaction({ id: "employee", companyId: "company-a", role: "SALES", isActive: true });
    await deactivateEmployeeInTransaction(mock as unknown as Prisma.TransactionClient, "company-a", "employee");
    expect(mock.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false } }));
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
    expect(mock.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { passwordHash: "new-hash" } }));
    expect(mock.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "employee" } });
    expect(mock.mobileSession.deleteMany).toHaveBeenCalledWith({ where: { userId: "employee" } });
  });
});
