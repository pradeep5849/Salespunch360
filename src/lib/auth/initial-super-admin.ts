import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "./password";
import { emailSchema, strongPasswordSchema } from "./validation";

const credentialsSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
}).strict();

type ProvisioningTransaction = Pick<Prisma.TransactionClient, "user">;
type PasswordHasher = (password: string) => Promise<string>;

export type InitialSuperAdminResult = "created" | "already-provisioned";

export async function provisionInitialSuperAdminInTransaction(
  tx: ProvisioningTransaction,
  rawCredentials: { email: string; password: string },
  passwordHasher: PasswordHasher = hashPassword,
): Promise<InitialSuperAdminResult> {
  const credentials = credentialsSchema.parse(rawCredentials);
  const [superAdmins, emailOwner] = await Promise.all([
    tx.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { email: true }, take: 2 }),
    tx.user.findUnique({ where: { email: credentials.email }, select: { role: true } }),
  ]);

  if (superAdmins.length > 1) throw new Error("MULTIPLE_SUPER_ADMINS");
  if (superAdmins.length === 1) {
    if (superAdmins[0].email === credentials.email) return "already-provisioned";
    throw new Error("SUPER_ADMIN_ALREADY_EXISTS");
  }
  if (emailOwner) throw new Error("EMAIL_ALREADY_IN_USE");

  const passwordHash = await passwordHasher(credentials.password);
  await tx.user.create({
    data: {
      name: "SalesPunch360 Super Admin",
      email: credentials.email,
      passwordHash,
      role: "SUPER_ADMIN",
      salesAccessActive: false,
      accountAccessActive: false,
      companyId: null,
    },
    select: { id: true },
  });
  return "created";
}

export function provisionInitialSuperAdmin(
  prisma: PrismaClient,
  rawCredentials: { email: string; password: string },
) {
  return prisma.$transaction(
    (tx) => provisionInitialSuperAdminInTransaction(tx, rawCredentials),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
