import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { resolveAccountBranchContext } from "./branch-context";
import type { ProjectActor } from "./projects";
export async function chequeEntryOptionsForActor(
  actor: ProjectActor,
  raw: unknown,
) {
  if (!canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_ENTRY"))
    throw new AuthorizationError();
  const input = z
    .object({
      branchId: z.string().guid().optional(),
      kind: z.enum(["BANK", "ALL"]).prefault("ALL"),
      q: z.string().trim().max(160).prefault(""),
      offset: z.coerce.number().int().min(0).max(1000000).prefault(0),
    })
    .strict()
    .parse(raw);
  const scope = await resolveAccountBranchContext(actor, {
    branchId: input.branchId,
  });
  const branchId =
    scope.context.mode === "BRANCH"
      ? scope.context.branchId
      : scope.branches[0]?.id;
  if (!branchId) throw new AuthorizationError();
  const accounts = await db.moneyAccount.findMany({
    where: {
      companyId: actor.companyId,
      isActive: true,
      ...(input.kind === "BANK" ? { type: "BANK" as const } : {}),
      name: { contains: input.q, mode: "insensitive" },
      OR: [{ branchId: null }, { branchId }],
    },
    select: { id: true, name: true, type: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: input.offset,
    take: 26,
  });
  return {
    branchId,
    branches: scope.branches.map(({ id, name }) => ({ id, name })),
    accounts: accounts.slice(0, 25),
    hasMore: accounts.length > 25,
  };
}
