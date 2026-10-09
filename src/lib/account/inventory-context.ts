import type { ProjectActor } from "./projects";
import { resolveAccountBranchContext } from "./branch-context";
import { ACCOUNT_ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { AuthorizationError } from "@/lib/auth/authorization";
import { requireAccountModules } from "./modules";
import { db } from "@/lib/db";
import { z } from "zod";
export async function inventoryContext(
  actor: ProjectActor,
  query: {
    branchId?: string | null;
    scope?: string | null;
    asOf?: string | null;
  } = {},
) {
  if (
    !actor.accountRole ||
    !ACCOUNT_ROLE_PERMISSIONS[actor.accountRole].includes("ACCOUNT_STOCK")
  )
    throw new AuthorizationError();
  await requireAccountModules(actor, "INVENTORY");
  const settings = await db.accountSettings.findUnique({
    where: { companyId: actor.companyId },
    select: { itemSettings: true },
  });
  if (
    (settings?.itemSettings as { enabled?: boolean } | null)?.enabled === false
  )
    throw new AuthorizationError();
  const { context } = await resolveAccountBranchContext(actor, query);
  const asOf = query.asOf
    ? z
        .string()
        .date()
        .transform((value) => new Date(`${value}T23:59:59.999Z`))
        .parse(query.asOf)
    : undefined;
  return {
    context,
    asOf,
    actor: {
      ...actor,
      branchAccessScope:
        context.mode === "BRANCH"
          ? ("SELECTED_BRANCHES" as const)
          : ("ALL_BRANCHES" as const),
      branchIds: context.mode === "BRANCH" ? [context.branchId] : [],
    },
  };
}
