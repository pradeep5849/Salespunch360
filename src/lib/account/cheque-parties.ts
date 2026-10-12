import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import type { ProjectActor } from "./projects";
export async function searchChequePartiesForActor(
  actor: ProjectActor,
  rawInput: unknown,
) {
  if (!canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_ENTRY"))
    throw new AuthorizationError();
  const input = z
    .object({
      branchId: z.string().uuid(),
      direction: z.enum(["RECEIVED", "ISSUED"]),
      q: z.string().trim().max(160).default(""),
      offset: z.coerce.number().int().min(0).max(1000000).default(0),
    })
    .strict()
    .parse(rawInput);
  if (
    !actor.companyId ||
    (actor.branchAccessScope === "SELECTED_BRANCHES" &&
      !actor.branchIds?.includes(input.branchId))
  )
    throw new AuthorizationError();
  if (
    !(await db.branch.findFirst({
      where: { id: input.branchId, companyId: actor.companyId, isActive: true },
      select: { id: true },
    }))
  )
    throw new AuthorizationError();
  const where = {
    companyId: actor.companyId,
    isActive: true,
    name: { contains: input.q, mode: "insensitive" as const },
  };
  const rows =
    input.direction === "RECEIVED"
      ? await db.customer.findMany({
          where: {
            ...where,
            branchId: input.branchId,
            isAccountCustomer: true,
          },
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: input.offset,
          take: 26,
        })
      : await db.vendor.findMany({
          where,
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: input.offset,
          take: 26,
        });
  return { rows: rows.slice(0, 25), hasMore: rows.length > 25 };
}
