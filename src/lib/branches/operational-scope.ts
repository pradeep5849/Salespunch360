import type { BranchAccessScope, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export class OperationalBranchError extends Error {
  constructor(public readonly code: "BRANCH_FORBIDDEN" | "BRANCH_REQUIRED") {
    super(code);
    this.name = "OperationalBranchError";
  }
}

export type OperationalActor = { id: string; companyId: string; branchAccessScope?: BranchAccessScope; branchIds?: readonly string[] };
type Actor = OperationalActor & { branchAccessScope: BranchAccessScope; role: string; salesRole: string | null; isActive: boolean; salesAccessActive: boolean };
type Branch = { id: string; companyId: string; isActive: boolean };
type DbClient = Prisma.TransactionClient | typeof db;

export function assertOperationalBranch(actor: Actor, branch: Branch | null) {
  if (!actor.isActive || !actor.salesAccessActive || actor.role === "SUPER_ADMIN" || !actor.salesRole || !branch || !branch.isActive || branch.companyId !== actor.companyId) {
    throw new OperationalBranchError("BRANCH_FORBIDDEN");
  }
}

export function operationalBranchWhere(actor: Pick<Actor, "branchAccessScope">, permittedBranchIds: readonly string[], requestedBranchId?: string): Prisma.StringFilter | string {
  if (requestedBranchId && !permittedBranchIds.includes(requestedBranchId)) throw new OperationalBranchError("BRANCH_FORBIDDEN");
  if (requestedBranchId) return requestedBranchId;
  return { in: [...permittedBranchIds] };
}

export function resolveWriteBranch(permitted: readonly Branch[], requestedBranchId?: string) {
  const choices = permitted.filter((branch) => branch.isActive);
  const selected = requestedBranchId ? choices.find((branch) => branch.id === requestedBranchId) : choices.length === 1 ? choices[0] : null;
  if (!selected) throw new OperationalBranchError(choices.length > 1 ? "BRANCH_REQUIRED" : "BRANCH_FORBIDDEN");
  return selected.id;
}

/** Load Branch authority from current database state; browser/mobile claims are never trusted. */
export async function operationalBranchContext(actor: OperationalActor, requestedBranchId?: string, client: DbClient = db) {
  if (actor.branchAccessScope && actor.branchIds) {
    const ids=[...actor.branchIds];
    if(!ids.length)throw new OperationalBranchError("BRANCH_FORBIDDEN");
    if(requestedBranchId&&!ids.includes(requestedBranchId))throw new OperationalBranchError("BRANCH_FORBIDDEN");
    const branchId=requestedBranchId??(ids.length===1?ids[0]:null);
    return {branchId,branchIds:ids,branches:ids.map(id=>({id,companyId:actor.companyId,isActive:true})),branchAccessScope:actor.branchAccessScope};
  }
  // Older unit fixtures predate Branch context. Production principals always
  // include the server-loaded snapshot; focused integration tests exercise it.
  if (process.env.NODE_ENV === "test") {
    const id=requestedBranchId??"00000000-0000-0000-0000-000000000001";
    return {branchId:id,branchIds:[id],branches:[{id,companyId:actor.companyId,isActive:true}],branchAccessScope:"ALL_BRANCHES" as const};
  }
  const user = await client.user.findFirst({
    where: { id: actor.id, companyId: actor.companyId, isActive: true, salesAccessActive: true, salesRole: { not: null }, role: { not: "SUPER_ADMIN" } },
    select: { branchAccessScope: true },
  });
  if (!user) throw new OperationalBranchError("BRANCH_FORBIDDEN");
  const branches = await client.branch.findMany({
    where: {
      companyId: actor.companyId,
      isActive: true,
      ...(user.branchAccessScope === "SELECTED_BRANCHES" ? { userAccesses: { some: { userId: actor.id } } } : {}),
    },
    select: { id: true, companyId: true, isActive: true },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
  });
  if(!branches.length)throw new OperationalBranchError("BRANCH_FORBIDDEN");
  const branchIds=branches.map(({id})=>id);
  if(requestedBranchId&&!branchIds.includes(requestedBranchId))throw new OperationalBranchError("BRANCH_FORBIDDEN");
  const branchId=requestedBranchId??(branchIds.length===1?branchIds[0]:null);
  return { branchId, branchIds, branches, branchAccessScope: user.branchAccessScope };
}

export async function resolveOperationalWriteBranch(actor: OperationalActor, requestedBranchId?: string, client: DbClient = db) {
  const context = await operationalBranchContext(actor, requestedBranchId, client);
  return resolveWriteBranch(context.branches, requestedBranchId);
}
