import type { Prisma } from "@prisma/client";
import { requirePermission, requirePermissionForMutation } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { EmployeePolicyError } from "@/lib/employees/policy";
import {
  employeeProfileUpdateSchema,
  serializeEmployeeDate,
  type EmployeeProfileUpdateInput,
} from "./employee-profile-validation";

const employeeSalesRoles = ["MANAGER", "SALES"] as const;

const employeeProfileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  employeeCode: true,
  designation: true,
  dateOfJoining: true,
} satisfies Prisma.UserSelect;

function normalizePhoneForComparison(phone: string | null | undefined) {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  return digits;
}

export async function assertSalesEmployeePhoneUnique(
  tx: Prisma.TransactionClient,
  companyId: string,
  phone: string | null | undefined,
  excludeUserId?: string,
) {
  const normalized = normalizePhoneForComparison(phone);
  if (!normalized) return;
  const users = await tx.user.findMany({
    where: {
      companyId,
      salesRole: { in: [...employeeSalesRoles] },
      phone: { not: null },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { phone: true },
  });
  if (users.some((user) => normalizePhoneForComparison(user.phone) === normalized)) {
    throw new EmployeePolicyError("PHONE_IN_USE");
  }
}

export async function getEmployeeProfile(employeeId: string) {
  const actor = await requirePermission("SALES_USER_ADMIN");
  if (!actor.companyId) throw new EmployeePolicyError("NOT_FOUND");
  const profile = await db.user.findFirst({
    where: { id: employeeId, companyId: actor.companyId, salesRole: { in: [...employeeSalesRoles] } },
    select: employeeProfileSelect,
  });
  if (!profile) throw new EmployeePolicyError("NOT_FOUND");
  return { ...profile, dateOfJoining: serializeEmployeeDate(profile.dateOfJoining) };
}

export async function updateEmployeeProfile(raw: EmployeeProfileUpdateInput) {
  const actor = await requirePermissionForMutation("SALES_USER_ADMIN");
  if (!actor.companyId) throw new EmployeePolicyError("NOT_FOUND");
  const companyId = actor.companyId;
  const data = employeeProfileUpdateSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: { id: data.employeeId, companyId, salesRole: { in: [...employeeSalesRoles] } },
      select: { id: true },
    });
    if (!target) throw new EmployeePolicyError("NOT_FOUND");
    await assertSalesEmployeePhoneUnique(tx, companyId, data.phone, target.id);
    return tx.user.update({
      where: { id: target.id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        employeeCode: data.employeeCode ?? null,
        designation: data.designation ?? null,
        dateOfJoining: data.dateOfJoining ?? null,
      },
      select: employeeProfileSelect,
    });
  }).then((profile) => ({ ...profile, dateOfJoining: serializeEmployeeDate(profile.dateOfJoining) }));
}
