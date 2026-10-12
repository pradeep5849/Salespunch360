import { ChequeStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import type { ProjectActor } from "./projects";

export const chequeListQuerySchema = z
  .object({
    q: z.string().trim().max(160).optional(),
    tab: z.enum(["OPEN", "CLOSED", "ALL"]).default("OPEN"),
    status: z.nativeEnum(ChequeStatus).optional(),
    branchId: z.string().uuid().optional(),
    order: z.enum(["asc", "desc"]).default("desc"),
    offset: z.coerce.number().int().min(0).max(10000000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
const openStatuses: ChequeStatus[] = ["ISSUED", "RECEIVED"];
const closedStatuses: ChequeStatus[] = [
  "DEPOSITED",
  "CLEARED",
  "BOUNCED",
  "CANCELLED",
];
export async function chequePageForActor(
  actor: ProjectActor,
  raw: unknown = {},
) {
  if (
    !actor.companyId ||
    !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_VIEW")
  )
    throw new AuthorizationError();
  const query = chequeListQuerySchema.parse(raw);
  if (query.branchId) {
    if (
      actor.branchAccessScope === "SELECTED_BRANCHES" &&
      !actor.branchIds?.includes(query.branchId)
    )
      throw new AuthorizationError();
    if (
      !(await db.branch.findFirst({
        where: {
          id: query.branchId,
          companyId: actor.companyId,
          isActive: true,
        },
        select: { id: true },
      }))
    )
      throw new AuthorizationError();
  }
  const where: Prisma.ChequeWhereInput = {
    AND: [
      {
        companyId: actor.companyId,
        ...(actor.branchAccessScope === "SELECTED_BRANCHES"
          ? { branchId: { in: actor.branchIds ?? [] } }
          : {}),
      },
      {
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.tab !== "ALL"
          ? {
              status: {
                in: query.tab === "OPEN" ? openStatuses : closedStatuses,
              },
            }
          : {}),
        ...(query.q
          ? {
              OR: [
                {
                  chequeNumber: {
                    contains: query.q,
                    mode: "insensitive" as const,
                  },
                },
                {
                  partyName: {
                    contains: query.q,
                    mode: "insensitive" as const,
                  },
                },
                {
                  reference: {
                    contains: query.q,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
      },
      ...(query.status ? [{ status: query.status }] : []),
    ],
  };
  const [rows, total] = await db.$transaction(
    [
      db.cheque.findMany({
        where,
        include: {
          settlement: {
            select: {
              allocations: {
                take: 2,
                orderBy: { id: "asc" },
                select: {
                  documentId: true,
                  document: { select: { type: true } },
                },
              },
            },
          },
        },
        orderBy: [
          { chequeDate: query.order },
          { createdAt: query.order },
          { id: query.order },
        ],
        skip: query.offset,
        take: query.limit,
      }),
      db.cheque.count({ where }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  const accounts = await db.moneyAccount.findMany({
    where: {
      companyId: actor.companyId,
      id: { in: [...new Set(rows.map((row) => row.moneyAccountId))] },
    },
    select: { id: true, name: true, type: true },
  });
  const names = new Map(accounts.map((account) => [account.id, account]));
  return {
    canClose: canUsePermission(
      actor,
      "SALESPUNCH360_ACCOUNT",
      "ACCOUNT_MONEY_ENTRY",
    ),
    canCorrect:
      canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_ENTRY") &&
      canUsePermission(
        actor,
        "SALESPUNCH360_ACCOUNT",
        "ACCOUNT_JOURNAL_REVERSE",
      ),
    rows: rows.map((row) => ({
      ...row,
      sourceDocument:
        row.settlement?.allocations.length === 1
          ? {
              id: row.settlement.allocations[0].documentId,
              type: row.settlement.allocations[0].document.type,
            }
          : null,
      moneyAccount: names.get(row.moneyAccountId) ?? null,
    })),
    total,
    offset: query.offset,
    limit: query.limit,
    nextOffset:
      query.offset + rows.length < total ? query.offset + rows.length : null,
  };
}
