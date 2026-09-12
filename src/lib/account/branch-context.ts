import type { AccountRole, BranchAccessScope } from "@prisma/client";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";

const COOKIE = "sp360_account_branch";
export type AccountBranchActor = {
  id: string;
  companyId: string;
  accountRole: AccountRole | null;
  branchAccessScope?: BranchAccessScope;
  branchIds?: readonly string[];
};
export type AuthorizedBranch = { id: string; name: string; isPrimary: boolean };
export type AccountBranchContext =
  | { mode: "COMPANY"; branchId: null; branchName: null }
  | { mode: "BRANCH"; branchId: string; branchName: string };

export function canUseCompanyConsolidation(actor: AccountBranchActor) {
  return actor.accountRole === "ACCOUNT_ADMIN" && actor.branchAccessScope === "ALL_BRANCHES";
}

export async function authorizedAccountBranches(actor: AccountBranchActor): Promise<AuthorizedBranch[]> {
  return db.branch.findMany({
    where: {
      companyId: actor.companyId,
      isActive: true,
      ...(actor.branchAccessScope === "SELECTED_BRANCHES" ? { id: { in: [...(actor.branchIds ?? [])] } } : {}),
    },
    select: { id: true, name: true, isPrimary: true },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }, { id: "asc" }],
  });
}

/** Resolves browser input only after tenant, active-Branch and assignment checks. */
export async function resolveAccountBranchContext(
  actor: AccountBranchActor,
  requested?: { scope?: string | null; branchId?: string | null },
): Promise<{ context: AccountBranchContext; branches: AuthorizedBranch[]; canConsolidate: boolean }> {
  const branches = await authorizedAccountBranches(actor);
  const canConsolidate = branches.length > 1 && canUseCompanyConsolidation(actor);
  if (requested?.scope === "all") {
    if (!canConsolidate) throw new AuthorizationError();
    return { context: { mode: "COMPANY", branchId: null, branchName: null }, branches, canConsolidate };
  }
  if (requested?.branchId) {
    const branch = branches.find(({ id }) => id === requested.branchId);
    if (!branch) throw new AuthorizationError();
    return { context: { mode: "BRANCH", branchId: branch.id, branchName: branch.name }, branches, canConsolidate };
  }
  const saved = (await cookies()).get(COOKIE)?.value;
  if (saved === "all" && canConsolidate)
    return { context: { mode: "COMPANY", branchId: null, branchName: null }, branches, canConsolidate };
  const savedBranch = branches.find(({ id }) => id === saved);
  if (savedBranch)
    return { context: { mode: "BRANCH", branchId: savedBranch.id, branchName: savedBranch.name }, branches, canConsolidate };
  const first = branches.find(branch => branch.isPrimary) ?? branches[0];
  if (!first) throw new AuthorizationError();
  return { context: { mode: "BRANCH", branchId: first.id, branchName: first.name }, branches, canConsolidate };
}

export async function rememberAccountBranchContext(value: "all" | string) {
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/workspace/account",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export const branchWhere = (context: AccountBranchContext) =>
  context.mode === "BRANCH" ? { branchId: context.branchId } : {};
