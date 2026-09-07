import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { provisionInitialSuperAdmin, provisionInitialSuperAdminInTransaction } from "./initial-super-admin";

const credentials = { email: "  ADMIN@EXAMPLE.COM ", password: "SecurePassword123" };

function transaction(superAdmins: { email: string }[], emailOwner: { role: string } | null) {
  return {
    user: {
      findMany: vi.fn().mockResolvedValue(superAdmins),
      findUnique: vi.fn().mockResolvedValue(emailOwner),
      create: vi.fn().mockResolvedValue({ id: "super-admin-id" }),
    },
  } as unknown as Pick<Prisma.TransactionClient, "user">;
}

describe("initial Super Admin provisioning", () => {
  it("runs the checks and creation in a serializable transaction", async () => {
    const tx = transaction([{ email: "admin@example.com" }], { role: "SUPER_ADMIN" });
    const $transaction = vi.fn(async (operation) => operation(tx));
    const prisma = { $transaction } as never;

    await expect(provisionInitialSuperAdmin(prisma, credentials)).resolves.toBe("already-provisioned");
    expect($transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("creates one standalone SUPER_ADMIN when none exists and the normalized email is unused", async () => {
    const tx = transaction([], null);
    const hash = vi.fn().mockResolvedValue("generated-hash");

    await expect(provisionInitialSuperAdminInTransaction(tx, credentials, hash)).resolves.toBe("created");
    expect(hash).toHaveBeenCalledWith(credentials.password);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        name: "SalesPunch360 Super Admin",
        email: "admin@example.com",
        passwordHash: "generated-hash",
        role: "SUPER_ADMIN",
        salesAccessActive: false,
        accountAccessActive: false,
        companyId: null,
      },
      select: { id: true },
    });
  });

  it("is a no-op when the one SUPER_ADMIN has the requested email", async () => {
    const tx = transaction([{ email: "admin@example.com" }], { role: "SUPER_ADMIN" });
    const hash = vi.fn();

    await expect(provisionInitialSuperAdminInTransaction(tx, credentials, hash)).resolves.toBe("already-provisioned");
    expect(hash).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("fails without hashing or creating when a different SUPER_ADMIN exists", async () => {
    const tx = transaction([{ email: "other@example.com" }], null);
    const hash = vi.fn();

    await expect(provisionInitialSuperAdminInTransaction(tx, credentials, hash)).rejects.toThrow("SUPER_ADMIN_ALREADY_EXISTS");
    expect(hash).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("fails without hashing or creating when the email belongs to a non-SUPER_ADMIN", async () => {
    const tx = transaction([], { role: "COMPANY_ADMIN" });
    const hash = vi.fn();

    await expect(provisionInitialSuperAdminInTransaction(tx, credentials, hash)).rejects.toThrow("EMAIL_ALREADY_IN_USE");
    expect(hash).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("fails without hashing or creating when multiple SUPER_ADMIN users exist", async () => {
    const tx = transaction([{ email: "one@example.com" }, { email: "two@example.com" }], null);
    const hash = vi.fn();

    await expect(provisionInitialSuperAdminInTransaction(tx, credentials, hash)).rejects.toThrow("MULTIPLE_SUPER_ADMINS");
    expect(hash).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });
});
