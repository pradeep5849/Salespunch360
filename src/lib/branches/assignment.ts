import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, requirePermissionForMutation } from "@/lib/auth/authorization";
import { assertBranchAssignmentTarget, BranchAssignmentError } from "./policy";
import { branchAssignmentSchema, type BranchAssignmentInput, type ValidBranchAssignment } from "./validation";

const optionSelect = { id: true, name: true, code: true, isPrimary: true } satisfies Prisma.BranchSelect;
const currentBranchSelect = { id: true, name: true, code: true, isPrimary: true, isActive: true } satisfies Prisma.BranchSelect;
const eligibleSalesRoles = ["MANAGER", "SALES"] as const;

async function readActor() {
  const actor = await requirePermission("SALES_USER_ADMIN");
  if (!actor.companyId) throw new BranchAssignmentError("NOT_FOUND");
  return { ...actor, companyId: actor.companyId };
}

async function mutationActor() {
  const actor = await requirePermissionForMutation("SALES_USER_ADMIN");
  if (!actor.companyId) throw new BranchAssignmentError("NOT_FOUND");
  return { ...actor, companyId: actor.companyId };
}

export async function listBranchAssignmentOptions() {
  const { companyId } = await readActor();
  return db.branch.findMany({
    where: { companyId, isActive: true },
    select: optionSelect,
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }, { id: "asc" }],
  });
}

export async function getEmployeeBranchAssignment(employeeId: string) {
  const { companyId } = await readActor();
  const target = await db.user.findFirst({
    where: { id: employeeId, companyId, salesRole: { in: [...eligibleSalesRoles] } },
    select: {
      id: true,
      companyId: true,
      salesRole: true,
      branchAccessScope: true,
      branchAccesses: { select: { branch: { select: currentBranchSelect } }, orderBy: { branchId: "asc" } },
    },
  });
  assertBranchAssignmentTarget(companyId, target);
  return {
    userId: target.id,
    branchAccessScope: target.branchAccessScope,
    branches: target.branchAccesses.map(({ branch }) => branch),
  };
}

export async function setEmployeeBranchAssignment(raw: BranchAssignmentInput) {
  const actor = await mutationActor();
  const assignment = branchAssignmentSchema.parse(raw);
  return db.$transaction(
    (tx) => replaceBranchAssignment(tx, actor.companyId, assignment),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function replaceBranchAssignment(tx: Prisma.TransactionClient, companyId: string, assignment: ValidBranchAssignment) {
  // The row lock serializes all replacements for one employee. The scoped re-read
  // remains authoritative and intentionally has no lifecycle-state predicates.
  await tx.$queryRaw<{ locked: number }[]>`
    SELECT 1::int AS "locked" FROM "users"
    WHERE "id" = ${assignment.employeeId}::uuid
    FOR UPDATE
  `;
  const target = await tx.user.findFirst({
    where: { id: assignment.employeeId, companyId, salesRole: { in: [...eligibleSalesRoles] } },
    select: { id: true, companyId: true, salesRole: true },
  });
  assertBranchAssignmentTarget(companyId, target);

  if (assignment.branchAccessScope === "SELECTED_BRANCHES") {
    const eligibleBranches = await tx.branch.findMany({
      where: { id: { in: assignment.branchIds }, companyId, isActive: true },
      select: { id: true },
    });
    if (eligibleBranches.length !== assignment.branchIds.length) throw new BranchAssignmentError("INVALID_BRANCH");
  }

  await tx.userBranchAccess.deleteMany({ where: { userId: target.id } });
  if (assignment.branchAccessScope === "SELECTED_BRANCHES") {
    await tx.userBranchAccess.createMany({ data: assignment.branchIds.map((branchId) => ({ userId: target.id, branchId })) });
  }
  await tx.user.update({ where: { id: target.id }, data: { branchAccessScope: assignment.branchAccessScope } });

  const [storedUser, storedAssignments] = await Promise.all([
    tx.user.findUnique({ where: { id: target.id }, select: { branchAccessScope: true } }),
    tx.userBranchAccess.findMany({ where: { userId: target.id }, select: { branchId: true } }),
  ]);
  const expectedIds = assignment.branchAccessScope === "SELECTED_BRANCHES" ? new Set(assignment.branchIds) : new Set<string>();
  if (
    storedUser?.branchAccessScope !== assignment.branchAccessScope ||
    storedAssignments.length !== expectedIds.size ||
    storedAssignments.some(({ branchId }) => !expectedIds.has(branchId))
  ) {
    throw new BranchAssignmentError("INVARIANT_VIOLATION");
  }
  return { userId: target.id, branchAccessScope: assignment.branchAccessScope, branchIds: [...expectedIds] };
}
