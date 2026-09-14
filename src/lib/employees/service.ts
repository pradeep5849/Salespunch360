import { Prisma, type SalesRole } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, requirePermissionForMutation } from "@/lib/auth/authorization";
import { hashPassword } from "@/lib/auth/crypto";
import { clearUserAuthentication, lockUser } from "@/lib/auth/session-generation";
import { deactivateIdentityWithLock, suspendSalesAccessInTransaction } from "@/lib/auth/lifecycle";
import { getTrialStatus } from "@/lib/trial/status";
import { profileComplete } from "@/lib/company/profile";
import { hasSalesWorkspace } from "@/lib/product/edition";
import { projectLegacyRole } from "@/lib/users/role-projection";
import { assertSalesEmployeePhoneUnique } from "@/lib/users/employee-profile";
import { assertAssignableManager, assertCanActivate, assertManagedEmployee, EmployeePolicyError } from "./policy";
import { assertLeavingManagerSafe, assertManagerOnlyTransitionSafe } from "./manager-type-transition";
import {salesRoleAssignment,salesRoleTransitionUpdate}from"./role-transition-policy";
import {
  createManagerSchema,
  createSalesSchema,
  editEmployeeSchema,
  employeeIdSchema,
  changeSalesRoleSchema,
  resetEmployeePasswordSchema,
  type CreateManagerInput,
  type CreateSalesInput,
  type EditEmployeeInput,
  type ResetEmployeePasswordInput,
} from "./validation";

const employeeSalesRoles: SalesRole[] = ["MANAGER", "SALES"];
export const employeeRoleDimensions = (salesRole: "MANAGER" | "SALES") => ({
  salesRole,
  role: projectLegacyRole({ salesRole, accountRole: null }),
});
const employeeSelect = {
  id: true, name: true, email: true, phone: true, employeeCode: true, designation:true,dateOfJoining:true,branchAccessScope:true,branchAccesses:{select:{branch:{select:{id:true,name:true,code:true,isActive:true}}}},
  // Compatibility/display only; authorization and employee identity use salesRole.
  role: true, salesRole: true, salesAccessActive: true, accountRole:true, accountAccessActive:true,
  isActive: true, managerId: true, managerType: true, companyId: true, travelAllowanceEnabled:true, travelRatePerKm:true,
  manager: { select: { id: true, name: true, isActive: true, salesAccessActive: true } },
} satisfies Prisma.UserSelect;

async function requireSalesUserAdmin(mutation: boolean) {
  const admin = mutation
    ? await requirePermissionForMutation("SALES_USER_ADMIN")
    : await requirePermission("SALES_USER_ADMIN");
  if (!admin.companyId) throw new EmployeePolicyError("NOT_FOUND");
  return { ...admin, companyId: admin.companyId };
}

async function lockAndLoadCompany(tx: Prisma.TransactionClient, companyId: string) {
  await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id" = ${companyId}::uuid FOR UPDATE`;
  const company = await tx.company.findFirst({
    where: { id: companyId },
    select: { subscriptionStatus: true, trialStartedAt: true, trialEndsAt: true, teamStructure: true, productEdition:true, name:true,addressLine1:true,city:true,state:true,postalCode:true,country:true,primaryContactName:true,primaryPhone:true,contactEmail:true },
  });
  if (!company) throw new EmployeePolicyError("NOT_FOUND");
  return company;
}

async function enforceAdminReadiness(tx:Prisma.TransactionClient,companyId:string,adminId:string){
  const admin=await tx.user.findFirst({where:{companyId,id:adminId,salesRole:{in:["PRIMARY_ADMIN","ADMIN"]},isActive:true,salesAccessActive:true},select:{emailVerifiedAt:true}});
  if(!admin?.emailVerifiedAt)throw new EmployeePolicyError("EMAIL_VERIFICATION_REQUIRED");
  const company=await lockAndLoadCompany(tx,companyId);
  if(!profileComplete(company))throw new EmployeePolicyError("COMPANY_PROFILE_REQUIRED");
}

async function enforceAvailableSeat(tx: Prisma.TransactionClient, companyId: string, salesRole: "MANAGER" | "SALES") {
  const company = await lockAndLoadCompany(tx, companyId);
  const activeCount = await tx.user.count({ where: { companyId, salesRole, isActive: true, salesAccessActive:true } });
  const now=new Date(),paid=await tx.companySubscription.findFirst({where:{companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now},sourceOrder:{is:{provider:{not:"ACCOUNT_PACKAGE"}}}},orderBy:{endsAt:"desc"}});
  if(paid){const limit=salesRole==="MANAGER"?paid.managerSeats:paid.salesSeats;if(activeCount>=limit)throw new EmployeePolicyError("SEAT_LIMIT");return;}
  assertCanActivate(getTrialStatus(company).effectiveStatus, salesRole, activeCount);
}

async function loadAssignableManager(tx: Prisma.TransactionClient, companyId: string, managerId?: string | null) {
  if (!managerId) return null;
  const manager = await tx.user.findFirst({ where: { id: managerId, companyId }, select: { id: true, companyId: true, salesRole: true, isActive: true, salesAccessActive: true } });
  assertAssignableManager(companyId, manager);
  return manager.id;
}
async function validateBranches(tx:Prisma.TransactionClient,companyId:string,scope:"ALL_BRANCHES"|"SELECTED_BRANCHES",ids:string[]){const unique=[...new Set(ids)];if(scope==="SELECTED_BRANCHES"){if(!unique.length)throw new Error("BRANCH_REQUIRED");const count=await tx.branch.count({where:{companyId,id:{in:unique},isActive:true}});if(count!==unique.length)throw new Error("INVALID_BRANCH")}return scope==="SELECTED_BRANCHES"?unique:[]}
export function isEmployeeEmailUniqueError(error:unknown){if(!(error instanceof Prisma.PrismaClientKnownRequestError)||error.code!=="P2002")return false;const target=error.meta?.target;return Array.isArray(target)?target.length===1&&target[0]==="email":typeof target==="string"&&target.split(/[^A-Za-z]+/).includes("email")}
export function normalizeEmployeeCreateError(error:unknown):never{if(isEmployeeEmailUniqueError(error))throw new EmployeePolicyError("EMAIL_IN_USE");throw error}

export async function listEmployees(filter: "ALL" | "MANAGERS" | "SALES" | "ACTIVE" | "INACTIVE" = "ALL") {
  const { companyId } = await requireSalesUserAdmin(false);
  const where: Prisma.UserWhereInput = { companyId, salesRole: { in: employeeSalesRoles } };
  if (filter === "MANAGERS") where.salesRole = "MANAGER";
  if (filter === "SALES") where.salesRole = "SALES";
  if (filter === "ACTIVE") { where.isActive = true; where.salesAccessActive = true; }
  if (filter === "INACTIVE") where.isActive = false;
  return db.user.findMany({ where, select: employeeSelect, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
}

export async function getEmployeeManagementContext() {
  const { companyId } = await requireSalesUserAdmin(false);
  return getEmployeeManagementContextForCompany(companyId);
}

export async function getEmployeeManagementContextForCompany(companyId: string) {
  const [employees, company] = await Promise.all([
    db.user.findMany({ where: { companyId, salesRole: { in: employeeSalesRoles } }, select: employeeSelect, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    db.company.findFirst({ where: { id: companyId }, select: { subscriptionStatus: true, trialStartedAt: true, trialEndsAt: true, teamStructure: true } }),
  ]);
  if (!company) throw new EmployeePolicyError("NOT_FOUND");
  return { employees, trial: getTrialStatus(company), teamStructure: company.teamStructure };
}

async function createEmployeeForCompany(companyId: string, salesRole: "MANAGER" | "SALES", raw: unknown, adminId:string) {
  const data = salesRole === "MANAGER" ? createManagerSchema.parse(raw) : createSalesSchema.parse(raw);
  const passwordHash = await hashPassword(data.password);
  try{return await db.$transaction(async (tx) => {
    await enforceAdminReadiness(tx,companyId,adminId);
    const company = await lockAndLoadCompany(tx, companyId);
    if (company.teamStructure === "SALES_ONLY" && salesRole === "MANAGER") throw new EmployeePolicyError("MANAGERS_DISABLED");
    await enforceAvailableSeat(tx, companyId, salesRole);
    await assertSalesEmployeePhoneUnique(tx,companyId,data.phone);
    const requestedManagerId = "managerId" in data && typeof data.managerId === "string" ? data.managerId : undefined;
    if (company.teamStructure === "SALES_ONLY" && requestedManagerId) throw new EmployeePolicyError("MANAGERS_DISABLED");
    const managerId = salesRole === "SALES" ? await loadAssignableManager(tx, companyId, requestedManagerId) : null;
    const branchIds=await validateBranches(tx,companyId,data.branchAccessScope,data.branchIds);
    return tx.user.create({
      data: { companyId, ...employeeRoleDimensions(salesRole), isActive: true, salesAccessActive: hasSalesWorkspace(company.productEdition), name: data.name, email: data.email, phone: data.phone, employeeCode: data.employeeCode, designation: data.designation, dateOfJoining: data.dateOfJoining, passwordHash, managerId, managerType: salesRole === "MANAGER" ? ("managerType" in data ? data.managerType : "FIELD_MANAGER") : null,branchAccessScope:data.branchAccessScope,branchAccesses:branchIds.length?{create:branchIds.map(branchId=>({branchId}))}:undefined },
      select: employeeSelect,
    });
  });}catch(error){normalizeEmployeeCreateError(error)}
}

export async function createManager(input: CreateManagerInput) { const actor=await requireSalesUserAdmin(true); return createEmployeeForCompany(actor.companyId,"MANAGER",input,actor.id); }
export async function createSalesEmployee(input: CreateSalesInput) { const actor=await requireSalesUserAdmin(true); return createEmployeeForCompany(actor.companyId,"SALES",input,actor.id); }
export const createManagerForCompany=(companyId:string,input:unknown,adminId:string)=>createEmployeeForCompany(companyId,"MANAGER",input,adminId);
export const createSalesEmployeeForCompany=(companyId:string,input:unknown,adminId:string)=>createEmployeeForCompany(companyId,"SALES",input,adminId);

export async function editEmployee(raw: EditEmployeeInput) {
  const { companyId } = await requireSalesUserAdmin(true);
  const data = editEmployeeSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const company = await lockAndLoadCompany(tx, companyId);
    const employee = await tx.user.findFirst({ where: { id: data.employeeId, companyId, salesRole: { in: employeeSalesRoles } }, select: { id: true, companyId: true, salesRole: true, salesAccessActive: true, isActive: true, managerId: true, managerType: true, designation: true, dateOfJoining: true } });
    assertManagedEmployee(companyId, employee);
    if (company.teamStructure === "SALES_ONLY" && data.managerId) throw new EmployeePolicyError("MANAGERS_DISABLED");
    await assertSalesEmployeePhoneUnique(tx,companyId,data.phone,employee.id);
    if (employee.salesRole === "MANAGER" && data.managerId) throw new EmployeePolicyError("INVALID_MANAGER");
    if (employee.salesRole === "MANAGER" && data.managerType && data.managerType !== employee.managerType && data.managerType === "MANAGER_ONLY") {
      await assertManagerOnlyTransitionSafe(tx, companyId, employee.id);
    }
    const managerId = employee.salesRole === "SALES" && data.managerId !== undefined
      ? data.managerId === employee.managerId
        ? employee.managerId
        : await loadAssignableManager(tx, companyId, data.managerId)
      : employee.managerId;
    const updated = await tx.user.updateMany({
      where: { id: employee.id, companyId, salesRole: employee.salesRole },
      data: { name: data.name, email: data.email, phone: data.phone ?? null, employeeCode: data.employeeCode ?? null, designation: data.designation === undefined ? employee.designation : data.designation, dateOfJoining: data.dateOfJoining === undefined ? employee.dateOfJoining : data.dateOfJoining, managerId, managerType: employee.salesRole === "MANAGER" ? (data.managerType ?? employee.managerType ?? "FIELD_MANAGER") : null },
    });
    if (updated.count !== 1) throw new EmployeePolicyError("NOT_FOUND");
  });
}

export async function changeSalesRole(raw:unknown){const actor=await requireSalesUserAdmin(true);if(actor.salesRole!=="PRIMARY_ADMIN")throw new Error("NOT_AUTHORIZED");const data=changeSalesRoleSchema.parse(raw);return db.$transaction(async tx=>{const company=await lockAndLoadCompany(tx,actor.companyId);if(!hasSalesWorkspace(company.productEdition))throw new Error("SALES_NOT_ENTITLED");await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${data.employeeId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;const target=await tx.user.findFirst({where:{id:data.employeeId,companyId:actor.companyId,salesRole:{in:["ADMIN","MANAGER","SALES"]}},select:{id:true,salesRole:true,managerType:true,managerId:true,isActive:true,salesAccessActive:true,accountRole:true,accountAccessActive:true}});if(!target)throw new EmployeePolicyError("NOT_FOUND");const assignment=salesRoleAssignment(data.role,data.managerId),nextRole=assignment.salesRole,nextManagerType=assignment.managerType;if(company.teamStructure==="SALES_ONLY"&&nextRole==="MANAGER")throw new EmployeePolicyError("MANAGERS_DISABLED");if(nextRole==="MANAGER"&&nextManagerType==="MANAGER_ONLY"&&(target.salesRole!=="MANAGER"||target.managerType!=="MANAGER_ONLY"))await assertManagerOnlyTransitionSafe(tx,actor.companyId,target.id);if(target.salesRole==="MANAGER"&&nextRole!=="MANAGER")await assertLeavingManagerSafe(tx,actor.companyId,target.id);if(target.isActive&&target.salesAccessActive&&nextRole!==target.salesRole){if(nextRole==="ADMIN"){const now=new Date(),paid=await tx.companySubscription.findFirst({where:{companyId:actor.companyId,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now},sourceOrder:{is:{provider:{not:"ACCOUNT_PACKAGE"}}}},orderBy:{endsAt:"desc"}}),used=await tx.user.count({where:{companyId:actor.companyId,salesRole:"ADMIN",isActive:true,salesAccessActive:true,id:{not:target.id}}});if(!paid||used>=paid.adminSeats)throw new EmployeePolicyError("SEAT_LIMIT")}else await enforceAvailableSeat(tx,actor.companyId,nextRole)}const managerId=nextRole==="SALES"?await loadAssignableManager(tx,actor.companyId,assignment.managerId):null;if(nextRole==="ADMIN")await tx.userBranchAccess.deleteMany({where:{userId:target.id}});await tx.user.update({where:{id:target.id},data:{...salesRoleTransitionUpdate(target,{...assignment,managerId}),branchAccessScope:nextRole==="ADMIN"?"ALL_BRANCHES":undefined,sessionVersion:{increment:1}}});return{...target,salesRole:nextRole,managerType:nextManagerType,managerId,accountRole:target.accountRole,accountAccessActive:target.accountAccessActive}},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})}

export async function deactivateEmployee(raw: unknown) {
  const actor = await requireSalesUserAdmin(true);
  return deactivateEmployeeForCompany(actor.companyId,raw,actor.id);
}
export async function deactivateEmployeeForCompany(companyId:string,raw:unknown,adminId:string) {
  const { employeeId } = employeeIdSchema.parse(raw);
  await db.$transaction(async (tx) => {
    await lockAndLoadCompany(tx, companyId);
    const admin=await tx.user.findFirst({where:{id:adminId,companyId,salesRole:{in:["PRIMARY_ADMIN","ADMIN"]},isActive:true,salesAccessActive:true},select:{id:true}});
    if(!admin)throw new EmployeePolicyError("NOT_FOUND");
    await deactivateEmployeeInTransaction(tx, companyId, employeeId);
  });
}

export async function deactivateEmployeeInTransaction(tx: Prisma.TransactionClient, companyId: string, employeeId: string) {
    await lockUser(tx, employeeId);
    const employee = await tx.user.findFirst({ where: { id: employeeId, companyId, salesRole: { in: employeeSalesRoles } }, select: { id: true, companyId: true, salesRole: true, accountRole:true,accountAccessActive:true,isActive: true, salesAccessActive: true } });
    assertManagedEmployee(companyId, employee);
    if (employee.accountRole) await suspendSalesAccessInTransaction(tx, employeeId);
    else await deactivateIdentityWithLock(tx, employeeId);
}

export async function reactivateEmployee(raw: unknown) {
  const actor = await requireSalesUserAdmin(true);
  return reactivateEmployeeForCompany(actor.companyId,raw,actor.id);
}
export async function reactivateEmployeeForCompany(companyId:string,raw:unknown,adminId:string) {
  const { employeeId } = employeeIdSchema.parse(raw);
  await db.$transaction(async (tx) => {
    await enforceAdminReadiness(tx,companyId,adminId);
    const company = await lockAndLoadCompany(tx, companyId);
    const employee = await tx.user.findFirst({ where: { id: employeeId, companyId, salesRole: { in: employeeSalesRoles } }, select: { id: true, companyId: true, salesRole: true, salesAccessActive: true, isActive: true } });
    assertManagedEmployee(companyId, employee);
    if (company.teamStructure === "SALES_ONLY" && employee.salesRole === "MANAGER") throw new EmployeePolicyError("MANAGERS_DISABLED");
    if (employee.isActive && employee.salesAccessActive) return;
    await enforceAvailableSeat(tx, companyId, employee.salesRole);
    const salesAccessActive = Boolean(employee.salesRole) && hasSalesWorkspace(company.productEdition);
    const updated = await tx.user.updateMany({ where: { id: employeeId, companyId, salesRole: employee.salesRole }, data: { isActive: true, salesAccessActive } });
    if (updated.count !== 1) throw new EmployeePolicyError("NOT_FOUND");
  });
}

export async function resetEmployeePassword(raw: ResetEmployeePasswordInput) {
  const { companyId } = await requireSalesUserAdmin(true);
  const data = resetEmployeePasswordSchema.parse(raw);
  const passwordHash = await hashPassword(data.password);
  await db.$transaction((tx) => resetEmployeePasswordInTransaction(tx, companyId, data.employeeId, passwordHash));
}

export async function resetEmployeePasswordInTransaction(tx: Prisma.TransactionClient, companyId: string, employeeId: string, passwordHash: string) {
    await lockUser(tx, employeeId);
    const employee = await tx.user.findFirst({ where: { id: employeeId, companyId, salesRole: { in: employeeSalesRoles } }, select: { id: true, companyId: true, salesRole: true, isActive: true, salesAccessActive: true } });
    assertManagedEmployee(companyId, employee);
    const updated = await tx.user.updateMany({ where: { id: employee.id, companyId, salesRole: { in: employeeSalesRoles } }, data: { passwordHash, sessionVersion: { increment: 1 } } });
    if (updated.count !== 1) throw new EmployeePolicyError("NOT_FOUND");
    await clearUserAuthentication(tx, employee.id);
}
