import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { canUsePermission } from "@/lib/auth/permissions";
import { AuthorizationError } from "@/lib/auth/authorization";
import { resolveAccountBranchContext } from "./branch-context";
import { enabledModulesForCompany } from "./modules";
import { expenseRecordScope } from "./expenses";
import type { ProjectActor } from "./projects";
export const expenseAlertQuery = z
  .object({
    branchId: z.string().guid().optional(),
    scope: z.literal("all").optional(),
    offset: z.coerce.number().int().min(0).max(1000000).prefault(0),
    limit: z.coerce.number().int().min(1).max(100).prefault(50),
  })
  .strict()
  .refine((v) => !(v.branchId && v.scope), "Choose branch or company scope");
export async function pendingExpenseAlertsForActor(
  actor: ProjectActor,
  raw: unknown = {},
  countOnly = false,
) {
  if (!canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_DASHBOARD"))
    throw new AuthorizationError();
  const f = expenseAlertQuery.parse(raw);
  const branch = await resolveAccountBranchContext(actor, {
    branchId: f.branchId,
    scope: f.scope,
  });
  const scopedActor = {
    ...actor,
    branchAccessScope:
      branch.context.mode === "BRANCH"
        ? ("SELECTED_BRANCHES" as const)
        : ("ALL_BRANCHES" as const),
    branchIds:
      branch.context.mode === "BRANCH" ? [branch.context.branchId] : [],
  };
  const modules = await enabledModulesForCompany(actor.companyId);
  const allowed =
    canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_EXPENSE_VIEW") &&
    modules.includes("EXPENSES") &&
    (actor.accountRole !== "PROJECT_MANAGER" || modules.includes("PROJECTS"));
  const empty = {
    rows: [],
    total: 0,
    offset: f.offset,
    limit: f.limit,
    hasMore: false,
    branchContext: branch.context,
    scopedActor,
  };
  if (!allowed) return empty;
  const scope = await expenseRecordScope(actor);
  const where: Prisma.ExpenseTransactionWhereInput = {
    AND: [
      scope,
      ...(branch.context.mode === "BRANCH"
        ? [{ branchId: branch.context.branchId }]
        : []),
      {
        OR: [
          { status: "PENDING_APPROVAL" },
          { status: "POSTED", approvalReviewStatus: "PENDING" },
        ],
      },
    ],
  };
  const data = await db.$transaction(
    async (tx) => {
      const total = await tx.expenseTransaction.count({ where });
      const rows = countOnly
        ? []
        : await tx.expenseTransaction.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: f.offset,
            take: f.limit,
            select: {
              id: true,
              transactionNumber: true,
              reference: true,
              createdAt: true,
              totalAmount: true,
              status: true,
              approvalReviewStatus: true,
              branchId: true,
            },
          });
      return { rows, total };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  return {
    ...empty,
    ...data,
    hasMore: !countOnly && f.offset + f.limit < data.total,
  };
}
