import { Prisma, type AccountRole, type BranchAccessScope, type ManagerType, type ProductEdition, type SalesRole } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, requireUserForMutation, AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { strongPasswordSchema } from "@/lib/auth/validation";
import { revokeUserAuthenticationWithLock } from "@/lib/auth/session-generation";
import { projectLegacyRole } from "./role-projection";
import { assertEditableProductUser, roleChangeRequiresAuthenticationRevocation, validateUserRoleAssignment } from "./product-role-policy";
import { getTrialStatus } from "@/lib/trial/status";
import { assertCanActivate } from "@/lib/employees/policy";

const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((value) => value === "" || value === undefined ? null : value, schema.nullable());
const salesRole = optional(z.enum(["ADMIN", "MANAGER", "SALES"]));
const accountRole = optional(z.enum(["ACCOUNT_ADMIN", "ACCOUNTANT", "PROJECT_MANAGER", "DATA_ENTRY"]));
const managerType = optional(z.enum(["FIELD_MANAGER", "MANAGER_ONLY"]));
const managerId = optional(z.string().uuid());
const branchFields = {
  branchAccessScope: z.enum(["ALL_BRANCHES", "SELECTED_BRANCHES"]),
  branchIds: z.array(z.string().uuid()).default([]),
};
const roleFields = { salesRole, accountRole, managerType, managerId };

export const createProductUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  password: strongPasswordSchema,
  confirmPassword: z.string(),
  ...roleFields,
  ...branchFields,
}).strict().superRefine((value, context) => {
  if (value.password !== value.confirmPassword) context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
});

export const editProductUserSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  ...roleFields,
  salesAccessActive: z.boolean(),
  accountAccessActive: z.boolean(),
  ...branchFields,
}).strict();

export type ProductUserMutation = z.infer<typeof editProductUserSchema>;

async function administrationActor(mutation: boolean) {
  const actor = mutation ? await requireUserForMutation() : await requireUser();
  if (!actor.companyId || actor.role === "SUPER_ADMIN") throw new AuthorizationError();
  const company = await db.company.findUnique({ where: { id: actor.companyId }, select: { id: true, productEdition: true, teamStructure: true, subscriptionStatus: true, trialStartedAt:true,trialEndsAt:true } });
  if (!company || (!canUsePermission(actor, company.productEdition, "SALES_USER_ADMIN") && !canUsePermission(actor, company.productEdition, "ACCOUNT_USER_ADMIN"))) throw new AuthorizationError();
  return { actor: { ...actor, companyId: actor.companyId }, company };
}

function assertAssignment(edition: ProductEdition, input: { salesRole: SalesRole | null; accountRole: AccountRole | null; managerType: ManagerType | null; salesAccessActive?: boolean; accountAccessActive?: boolean }) {
  validateUserRoleAssignment(edition, { salesRole: input.salesRole as Exclude<SalesRole, "PRIMARY_ADMIN"> | null, accountRole: input.accountRole, managerType: input.managerType });
  if (input.salesAccessActive && !input.salesRole) throw new Error("SALES_ROLE_REQUIRED");
  if (input.accountAccessActive && !input.accountRole) throw new Error("ACCOUNT_ROLE_REQUIRED");
}

async function validateRelations(tx: Prisma.TransactionClient, companyId: string, input: { salesRole: SalesRole | null; managerId: string | null; branchAccessScope: BranchAccessScope; branchIds: string[] }) {
  if (input.salesRole === "SALES" && input.managerId) {
    const manager = await tx.user.findFirst({ where: { id: input.managerId, companyId, isActive: true, salesAccessActive: true, salesRole: "MANAGER" }, select: { id: true } });
    if (!manager) throw new Error("INVALID_MANAGER");
  } else if (input.managerId) throw new Error("INVALID_MANAGER");
  const uniqueBranchIds = [...new Set(input.branchIds)];
  if (input.branchAccessScope === "SELECTED_BRANCHES") {
    if (!uniqueBranchIds.length) throw new Error("BRANCH_REQUIRED");
    const count = await tx.branch.count({ where: { id: { in: uniqueBranchIds }, companyId, isActive: true } });
    if (count !== uniqueBranchIds.length) throw new Error("INVALID_BRANCH");
  }
  return input.branchAccessScope === "SELECTED_BRANCHES" ? uniqueBranchIds : [];
}

async function replaceBranches(tx: Prisma.TransactionClient, userId: string, scope: BranchAccessScope, branchIds: string[]) {
  await tx.userBranchAccess.deleteMany({ where: { userId } });
  if (scope === "SELECTED_BRANCHES") await tx.userBranchAccess.createMany({ data: branchIds.map((branchId) => ({ userId, branchId })) });
}

async function enforceSalesSeat(tx:Prisma.TransactionClient,company:Awaited<ReturnType<typeof administrationActor>>["company"],role:Exclude<SalesRole,"PRIMARY_ADMIN">,excludeUserId?:string){
 const now=new Date(),used=await tx.user.count({where:{companyId:company.id,salesRole:role,isActive:true,salesAccessActive:true,...(excludeUserId?{id:{not:excludeUserId}}:{})}}),subscription=await tx.companySubscription.findFirst({where:{companyId:company.id,status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now}},orderBy:{endsAt:"desc"}});
 if(role==="ADMIN"){if(used>=(subscription?.adminSeats??0))throw new Error("SEAT_LIMIT");return;}
 if(subscription){const limit=role==="MANAGER"?subscription.managerSeats:subscription.salesSeats;if(used>=limit)throw new Error("SEAT_LIMIT");return;}
 assertCanActivate(getTrialStatus(company).effectiveStatus,role,used);
}

export async function getProductUserManagementContext() {
  const { actor, company } = await administrationActor(false);
  const [users, branches] = await Promise.all([
    db.user.findMany({
      where: { companyId: company.id, role: { not: "SUPER_ADMIN" }, OR: [{ salesRole: { not: "PRIMARY_ADMIN" } }, { salesRole: null }] },
      select: { id:true,name:true,email:true,isActive:true,salesRole:true,accountRole:true,managerType:true,managerId:true,salesAccessActive:true,accountAccessActive:true,branchAccessScope:true,branchAccesses:{select:{branchId:true}} },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    db.branch.findMany({ where: { companyId: company.id, isActive: true }, select: { id:true,name:true,code:true,isPrimary:true }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] }),
  ]);
  return { actor, edition: company.productEdition, teamStructure: company.teamStructure, users, branches };
}

export async function createProductUser(raw: unknown) {
  const { actor, company } = await administrationActor(true);
  const input = createProductUserSchema.parse(raw);
  assertAssignment(company.productEdition, { ...input, salesAccessActive: !!input.salesRole, accountAccessActive: !!input.accountRole });
  if (input.salesRole && !canUsePermission(actor, company.productEdition, "SALES_USER_ADMIN")) throw new AuthorizationError();
  if (input.accountRole && !canUsePermission(actor, company.productEdition, "ACCOUNT_USER_ADMIN")) throw new AuthorizationError();
  if (company.subscriptionStatus === "SUSPENDED" || company.subscriptionStatus === "EXPIRED") throw new Error("WORKSPACE_SUSPENDED");
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${company.id}::uuid FOR UPDATE`;
    if(input.salesRole)await enforceSalesSeat(tx,company,input.salesRole);
    const branchIds = await validateRelations(tx, company.id, input);
    const user = await tx.user.create({ data: {
      companyId: company.id, name: input.name, email: input.email, passwordHash,
      role: projectLegacyRole(input), salesRole: input.salesRole, accountRole: input.accountRole,
      managerType: input.salesRole === "MANAGER" ? input.managerType : null,
      managerId: input.salesRole === "SALES" ? input.managerId : null,
      salesAccessActive: !!input.salesRole, accountAccessActive: !!input.accountRole,
      branchAccessScope: input.branchAccessScope,
    } });
    await replaceBranches(tx, user.id, input.branchAccessScope, branchIds);
    return user;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function editProductUser(raw: unknown) {
  const { actor, company } = await administrationActor(true);
  const input = editProductUserSchema.parse(raw);
  assertAssignment(company.productEdition, input);
  if (input.salesRole && !canUsePermission(actor, company.productEdition, "SALES_USER_ADMIN")) throw new AuthorizationError();
  if (input.accountRole && !canUsePermission(actor, company.productEdition, "ACCOUNT_USER_ADMIN")) throw new AuthorizationError();
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${input.userId}::uuid AND "companyId"=${company.id}::uuid FOR UPDATE`;
    const target = await tx.user.findFirst({ where: { id: input.userId, companyId: company.id, role: { not: "SUPER_ADMIN" } }, select: { id:true,companyId:true,salesRole:true,accountRole:true,managerType:true,managerId:true,salesAccessActive:true,accountAccessActive:true,branchAccessScope:true,branchAccesses:{select:{branchId:true}} } });
    assertEditableProductUser(company.id,target);
    if (target.salesRole && !canUsePermission(actor, company.productEdition, "SALES_USER_ADMIN")) throw new AuthorizationError();
    if (target.accountRole && !canUsePermission(actor, company.productEdition, "ACCOUNT_USER_ADMIN")) throw new AuthorizationError();
    const branchIds = await validateRelations(tx, company.id, input);
    if(input.salesRole&&input.salesAccessActive&&(!target.salesAccessActive||target.salesRole!==input.salesRole))await enforceSalesSeat(tx,company,input.salesRole,target.id);
    const securityChanged = roleChangeRequiresAuthenticationRevocation({...target,salesRole:target.salesRole as Exclude<SalesRole,"PRIMARY_ADMIN">|null,branchIds:target.branchAccesses.map(({branchId})=>branchId)},{...input,branchIds});
    await tx.user.update({ where: { id: target.id }, data: {
      name: input.name, email: input.email, role: projectLegacyRole(input), salesRole: input.salesRole, accountRole: input.accountRole,
      managerType: input.salesRole === "MANAGER" ? input.managerType : null, managerId: input.salesRole === "SALES" ? input.managerId : null,
      salesAccessActive: input.salesAccessActive && !!input.salesRole, accountAccessActive: input.accountAccessActive && !!input.accountRole,
      branchAccessScope: input.branchAccessScope,
    } });
    await replaceBranches(tx, target.id, input.branchAccessScope, branchIds);
    if (securityChanged) await revokeUserAuthenticationWithLock(tx, target.id);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
