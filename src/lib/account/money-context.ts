import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { resolveAccountBranchContext } from "./branch-context";
import type { ProjectActor } from "./projects";
export const moneyReadQuery = z
  .object({
    branchId: z.string().uuid().optional(),
    scope: z.literal("all").optional(),
  })
  .strict()
  .refine(
    (query) => !(query.branchId && query.scope),
    "Choose a branch or company scope",
  );
export async function moneyReadContext(actor: ProjectActor, raw: unknown = {}) {
  if (!canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_VIEW"))
    throw new AuthorizationError();
  const resolved = await resolveAccountBranchContext(
    actor,
    moneyReadQuery.parse(raw),
  );
  return {
    ...resolved,
    actor: {
      ...actor,
      branchAccessScope:
        resolved.context.mode === "BRANCH"
          ? ("SELECTED_BRANCHES" as const)
          : ("ALL_BRANCHES" as const),
      branchIds:
        resolved.context.mode === "BRANCH" ? [resolved.context.branchId] : [],
    },
  };
}
