import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requirePermissionForMutation } from "@/lib/auth/authorization";
import { hashPassword } from "@/lib/auth/crypto";
import { strongPasswordSchema } from "@/lib/auth/validation";
import { assertSalesEmployeePhoneUnique } from "@/lib/users/employee-profile";
import { phoneSchema } from "@/lib/employees/validation";
import { assertTelecallerSeatAvailable } from "@/lib/billing/telecaller";
import { TELECALLER_DESIGNATION } from "./policy";

const createTelecallerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email().max(320),
  phone: z.preprocess(v => typeof v === "string" && !v.trim() ? undefined : v, phoneSchema.optional()),
  employeeCode: z.preprocess(v => typeof v === "string" && !v.trim() ? undefined : v, z.string().trim().max(80).optional()),
  password: strongPasswordSchema,
  confirmPassword: z.string().min(1).max(200),
}).strict().superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
});

export type TelecallerEmployee = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  employeeCode: string | null;
  isActive: boolean;
  createdAt: Date;
};

export async function listTelecallerEmployees(): Promise<TelecallerEmployee[]> {
  const actor = await requirePermission("SALES_USER_ADMIN");
  if (!actor.companyId) throw new Error("NOT_AUTHORIZED");
  return db.user.findMany({
    where: { companyId: actor.companyId, salesRole: "SALES", designation: { equals: TELECALLER_DESIGNATION, mode: "insensitive" } },
    select: { id: true, name: true, email: true, phone: true, employeeCode: true, isActive: true, createdAt: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function createTelecallerEmployee(raw: unknown) {
  const actor = await requirePermissionForMutation("SALES_USER_ADMIN");
  if (!actor.companyId || actor.salesRole !== "PRIMARY_ADMIN") throw new Error("NOT_AUTHORIZED");
  const data = createTelecallerSchema.parse(raw);
  await assertTelecallerSeatAvailable(actor.companyId);
  const passwordHash = await hashPassword(data.password);
  try {
    return await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "companies" WHERE id=${actor.companyId}::uuid FOR UPDATE`;
      const company = await tx.company.findUnique({ where: { id: actor.companyId }, select: { productEdition: true } });
      if (!company || (company.productEdition !== "SALESPUNCH360" && company.productEdition !== "SALESPUNCH360_PLUS")) throw new Error("SALES_NOT_ENTITLED");
      const paid = await tx.$queryRaw<{ seats: number }[]>(Prisma.sql`SELECT seats FROM "telecaller_subscriptions" WHERE "companyId"=${actor.companyId}::uuid AND status='ACTIVE' AND "startsAt"<=NOW() AND "endsAt">NOW() ORDER BY "endsAt" DESC LIMIT 1 FOR UPDATE`);
      if (!paid[0]) throw new Error("TELECALLER_SUBSCRIPTION_REQUIRED");
      const used = await tx.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "users" WHERE "companyId"=${actor.companyId}::uuid AND "isActive"=TRUE AND "salesRole"='SALES'::"SalesRole" AND upper(replace(coalesce(designation,''),' ',''))='TELECALLER'`);
      if (Number(used[0]?.count ?? 0) >= paid[0].seats) throw new Error("TELECALLER_SEAT_LIMIT");
      if (data.phone) await assertSalesEmployeePhoneUnique(tx, actor.companyId, data.phone);
      return tx.user.create({
        data: {
          companyId: actor.companyId,
          role: "SALES",
          salesRole: "SALES",
          accountRole: null,
          salesAccessActive: false,
          accountAccessActive: false,
          managerType: null,
          managerId: null,
          branchAccessScope: "ALL_BRANCHES",
          name: data.name,
          email: data.email,
          phone: data.phone ?? null,
          employeeCode: data.employeeCode ?? null,
          designation: TELECALLER_DESIGNATION,
          passwordHash,
          isActive: true,
        },
        select: { id: true, name: true, email: true, phone: true, employeeCode: true, isActive: true, createdAt: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("EMAIL_IN_USE");
    const message = error instanceof Error ? error.message : "TELECALLER_CREATE_FAILED";
    if (message.includes("TELECALLER_SUBSCRIPTION_REQUIRED")) throw new Error("TELECALLER_SUBSCRIPTION_REQUIRED");
    if (message.includes("TELECALLER_SEAT_LIMIT")) throw new Error("TELECALLER_SEAT_LIMIT");
    throw error;
  }
}

export async function setTelecallerActive(userId: string, active: boolean) {
  const actor = await requirePermissionForMutation("SALES_USER_ADMIN");
  if (!actor.companyId || actor.salesRole !== "PRIMARY_ADMIN") throw new Error("NOT_AUTHORIZED");
  if (active) await assertTelecallerSeatAvailable(actor.companyId, userId);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "companies" WHERE id=${actor.companyId}::uuid FOR UPDATE`;
    const telecaller = await tx.user.findFirst({ where: { id: userId, companyId: actor.companyId, salesRole: "SALES", designation: { equals: TELECALLER_DESIGNATION, mode: "insensitive" } }, select: { id: true } });
    if (!telecaller) throw new Error("NOT_FOUND");
    const updated = await tx.user.update({ where: { id: userId }, data: { isActive: active, salesAccessActive: false, sessionVersion: { increment: 1 } }, select: { id: true, isActive: true } });
    if (!active) {
      await tx.session.deleteMany({ where: { userId } });
      await tx.pushDevice.deleteMany({ where: { userId } });
    }
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}