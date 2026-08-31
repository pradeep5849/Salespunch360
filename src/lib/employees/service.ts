import type { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/authorization";
import { hashPassword } from "@/lib/auth/crypto";
import { getTrialStatus } from "@/lib/trial/status";
import { profileComplete } from "@/lib/company/profile";
import { assertAssignableManager, assertCanActivate, assertManagedEmployee, EmployeePolicyError } from "./policy";
import {
  createManagerSchema,
  createSalesSchema,
  editEmployeeSchema,
  employeeIdSchema,
  resetEmployeePasswordSchema,
  type CreateManagerInput,
  type CreateSalesInput,
  type EditEmployeeInput,
  type ResetEmployeePasswordInput,
} from "./validation";

const employeeRoles: Role[] = ["MANAGER", "SALES"];
const employeeSelect = {
  id: true, name: true, email: true, phone: true, employeeCode: true, role: true,
  isActive: true, managerId: true, companyId: true,
  manager: { select: { id: true, name: true, isActive: true } },
} satisfies Prisma.UserSelect;

async function requireCompanyAdmin() {
  const admin = await requireRole("COMPANY_ADMIN");
  if (!admin.companyId) throw new EmployeePolicyError("NOT_FOUND");
  return { ...admin, companyId: admin.companyId };
}

async function lockAndLoadCompany(tx: Prisma.TransactionClient, companyId: string) {
  await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id" = ${companyId}::uuid FOR UPDATE`;
  const company = await tx.company.findFirst({
    where: { id: companyId },
    select: { subscriptionStatus: true, trialStartedAt: true, trialEndsAt: true, teamStructure: true, name:true,addressLine1:true,city:true,state:true,postalCode:true,country:true,primaryContactName:true,primaryPhone:true,contactEmail:true },
  });
  if (!company) throw new EmployeePolicyError("NOT_FOUND");
  return company;
}

async function enforceAdminReadiness(tx:Prisma.TransactionClient,companyId:string,adminId:string){
  const admin=await tx.user.findFirst({where:{companyId,role:"COMPANY_ADMIN",id:adminId},select:{emailVerifiedAt:true}});
  if(!admin?.emailVerifiedAt)throw new EmployeePolicyError("EMAIL_VERIFICATION_REQUIRED");
  const company=await lockAndLoadCompany(tx,companyId);
  if(!profileComplete(company))throw new EmployeePolicyError("COMPANY_PROFILE_REQUIRED");
}

async function enforceAvailableSeat(tx: Prisma.TransactionClient, companyId: string, role: "MANAGER" | "SALES") {
  const company = await lockAndLoadCompany(tx, companyId);
  const activeCount = await tx.user.count({ where: { companyId, role, isActive: true } });
  const now=new Date(),paid=await tx.companySubscription.findFirst({where:{companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now}},orderBy:{endsAt:"desc"}});
  if(paid){const limit=role==="MANAGER"?paid.managerSeats:paid.salesSeats;if(activeCount>=limit)throw new EmployeePolicyError("SEAT_LIMIT");return;}
  assertCanActivate(getTrialStatus(company).effectiveStatus, role, activeCount);
}

async function loadAssignableManager(tx: Prisma.TransactionClient, companyId: string, managerId?: string | null) {
  if (!managerId) return null;
  const manager = await tx.user.findFirst({ where: { id: managerId, companyId }, select: { id: true, companyId: true, role: true, isActive: true } });
  assertAssignableManager(companyId, manager);
  return manager.id;
}

export async function listEmployees(filter: "ALL" | "MANAGERS" | "SALES" | "ACTIVE" | "INACTIVE" = "ALL") {
  const { companyId } = await requireCompanyAdmin();
  const where: Prisma.UserWhereInput = { companyId, role: { in: employeeRoles } };
  if (filter === "MANAGERS") where.role = "MANAGER";
  if (filter === "SALES") where.role = "SALES";
  if (filter === "ACTIVE") where.isActive = true;
  if (filter === "INACTIVE") where.isActive = false;
  return db.user.findMany({ where, select: employeeSelect, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
}

export async function getEmployeeManagementContext() {
  const { companyId } = await requireCompanyAdmin();
  return getEmployeeManagementContextForCompany(companyId);
}

export async function getEmployeeManagementContextForCompany(companyId: string) {
  const [employees, company] = await Promise.all([
    db.user.findMany({ where: { companyId, role: { in: employeeRoles } }, select: employeeSelect, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    db.company.findFirst({ where: { id: companyId }, select: { subscriptionStatus: true, trialStartedAt: true, trialEndsAt: true, teamStructure: true } }),
  ]);
  if (!company) throw new EmployeePolicyError("NOT_FOUND");
  return { employees, trial: getTrialStatus(company), teamStructure: company.teamStructure };
}

async function createEmployeeForCompany(companyId: string, role: "MANAGER" | "SALES", raw: unknown, adminId:string) {
  const data = role === "MANAGER" ? createManagerSchema.parse(raw) : createSalesSchema.parse(raw);
  const passwordHash = await hashPassword(data.password);
  return db.$transaction(async (tx) => {
    await enforceAdminReadiness(tx,companyId,adminId);
    const company = await lockAndLoadCompany(tx, companyId);
    if (company.teamStructure === "SALES_ONLY" && role === "MANAGER") throw new EmployeePolicyError("MANAGERS_DISABLED");
    await enforceAvailableSeat(tx, companyId, role);
    const requestedManagerId = "managerId" in data && typeof data.managerId === "string" ? data.managerId : undefined;
    if (company.teamStructure === "SALES_ONLY" && requestedManagerId) throw new EmployeePolicyError("MANAGERS_DISABLED");
    const managerId = role === "SALES" ? await loadAssignableManager(tx, companyId, requestedManagerId) : null;
    return tx.user.create({
      data: { companyId, role, isActive: true, name: data.name, email: data.email, phone: data.phone, employeeCode: data.employeeCode, passwordHash, managerId },
      select: employeeSelect,
    });
  });
}

export async function createManager(input: CreateManagerInput) { const actor=await requireCompanyAdmin(); return createEmployeeForCompany(actor.companyId,"MANAGER",input,actor.id); }
export async function createSalesEmployee(input: CreateSalesInput) { const actor=await requireCompanyAdmin(); return createEmployeeForCompany(actor.companyId,"SALES",input,actor.id); }
export const createManagerForCompany=(companyId:string,input:unknown,adminId:string)=>createEmployeeForCompany(companyId,"MANAGER",input,adminId);
export const createSalesEmployeeForCompany=(companyId:string,input:unknown,adminId:string)=>createEmployeeForCompany(companyId,"SALES",input,adminId);

export async function editEmployee(raw: EditEmployeeInput) {
  const { companyId } = await requireCompanyAdmin();
  const data = editEmployeeSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const company = await lockAndLoadCompany(tx, companyId);
    const employee = await tx.user.findFirst({ where: { id: data.employeeId, companyId, role: { in: employeeRoles } }, select: { id: true, companyId: true, role: true, isActive: true, managerId: true } });
    assertManagedEmployee(companyId, employee);
    if (company.teamStructure === "SALES_ONLY" && data.managerId) throw new EmployeePolicyError("MANAGERS_DISABLED");
    if (employee.role === "MANAGER" && data.managerId) throw new EmployeePolicyError("INVALID_MANAGER");
    const managerId = employee.role === "SALES" && data.managerId !== undefined
      ? data.managerId === employee.managerId
        ? employee.managerId
        : await loadAssignableManager(tx, companyId, data.managerId)
      : employee.managerId;
    const updated = await tx.user.updateMany({
      where: { id: employee.id, companyId, role: employee.role },
      data: { name: data.name, email: data.email, phone: data.phone ?? null, employeeCode: data.employeeCode ?? null, managerId },
    });
    if (updated.count !== 1) throw new EmployeePolicyError("NOT_FOUND");
  });
}

export async function deactivateEmployee(raw: unknown) {
  const actor = await requireCompanyAdmin();
  return deactivateEmployeeForCompany(actor.companyId,raw,actor.id);
}
export async function deactivateEmployeeForCompany(companyId:string,raw:unknown,adminId:string) {
  const { employeeId } = employeeIdSchema.parse(raw);
  await db.$transaction(async (tx) => {
    await lockAndLoadCompany(tx, companyId);
    const admin=await tx.user.findFirst({where:{id:adminId,companyId,role:"COMPANY_ADMIN"},select:{id:true}});
    if(!admin)throw new EmployeePolicyError("NOT_FOUND");
    await deactivateEmployeeInTransaction(tx, companyId, employeeId);
  });
}

export async function deactivateEmployeeInTransaction(tx: Prisma.TransactionClient, companyId: string, employeeId: string) {
    const employee = await tx.user.findFirst({ where: { id: employeeId, companyId, role: { in: employeeRoles } }, select: { id: true, companyId: true, role: true, isActive: true } });
    assertManagedEmployee(companyId, employee);
    const updated = await tx.user.updateMany({ where: { id: employeeId, companyId, role: { in: employeeRoles } }, data: { isActive: false } });
    if (updated.count !== 1) throw new EmployeePolicyError("NOT_FOUND");
    await tx.session.deleteMany({ where: { userId: employeeId } });
    await tx.mobileSession.deleteMany({ where: { userId: employeeId } });
}

export async function reactivateEmployee(raw: unknown) {
  const actor = await requireCompanyAdmin();
  return reactivateEmployeeForCompany(actor.companyId,raw,actor.id);
}
export async function reactivateEmployeeForCompany(companyId:string,raw:unknown,adminId:string) {
  const { employeeId } = employeeIdSchema.parse(raw);
  await db.$transaction(async (tx) => {
    await enforceAdminReadiness(tx,companyId,adminId);
    const company = await lockAndLoadCompany(tx, companyId);
    const employee = await tx.user.findFirst({ where: { id: employeeId, companyId, role: { in: employeeRoles } }, select: { id: true, companyId: true, role: true, isActive: true } });
    assertManagedEmployee(companyId, employee);
    if (company.teamStructure === "SALES_ONLY" && employee.role === "MANAGER") throw new EmployeePolicyError("MANAGERS_DISABLED");
    if (employee.isActive) return;
    await enforceAvailableSeat(tx, companyId, employee.role as "MANAGER" | "SALES");
    const updated = await tx.user.updateMany({ where: { id: employeeId, companyId, role: employee.role, isActive: false }, data: { isActive: true } });
    if (updated.count !== 1) throw new EmployeePolicyError("NOT_FOUND");
  });
}

export async function resetEmployeePassword(raw: ResetEmployeePasswordInput) {
  const { companyId } = await requireCompanyAdmin();
  const data = resetEmployeePasswordSchema.parse(raw);
  const passwordHash = await hashPassword(data.password);
  await db.$transaction((tx) => resetEmployeePasswordInTransaction(tx, companyId, data.employeeId, passwordHash));
}

export async function resetEmployeePasswordInTransaction(tx: Prisma.TransactionClient, companyId: string, employeeId: string, passwordHash: string) {
    const employee = await tx.user.findFirst({ where: { id: employeeId, companyId, role: { in: employeeRoles } }, select: { id: true, companyId: true, role: true, isActive: true } });
    assertManagedEmployee(companyId, employee);
    const updated = await tx.user.updateMany({ where: { id: employee.id, companyId, role: { in: employeeRoles } }, data: { passwordHash } });
    if (updated.count !== 1) throw new EmployeePolicyError("NOT_FOUND");
    await tx.session.deleteMany({ where: { userId: employee.id } });
    await tx.mobileSession.deleteMany({ where: { userId: employee.id } });
}
