import type { Prisma } from "@prisma/client";
import type { AccountBranchActor, AccountBranchContext } from "./branch-context";

/** Home combines normalized Branch context with the actor's Project authorization. */
export function accountHomeScopes(actor: AccountBranchActor, context: AccountBranchContext) {
  const branch = context.mode === "BRANCH" ? { branchId: context.branchId } : {};
  const projectAuthorization = actor.accountRole === "PROJECT_MANAGER" ? { projectManagerId: actor.id } : {};
  const projectBound = actor.accountRole === "PROJECT_MANAGER" ? { project: { is: { projectManagerId: actor.id } } } : {};
  return {
    document: { companyId: actor.companyId, ...branch, ...projectBound } satisfies Prisma.CommercialDocumentWhereInput,
    project: { companyId: actor.companyId, ...branch, ...projectAuthorization } satisfies Prisma.ProjectWhereInput,
    expense: { companyId: actor.companyId, ...branch, ...projectBound } satisfies Prisma.ExpenseTransactionWhereInput,
  };
}

export function accountQuickActionHref(href: string, context: AccountBranchContext) {
  if (context.mode !== "BRANCH") return href;
  return `${href}${href.includes("?") ? "&" : "?"}branchId=${encodeURIComponent(context.branchId)}`;
}
