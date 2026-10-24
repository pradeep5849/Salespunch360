import {chequeTransactionTarget} from "./cheque-transaction-target";
import { ChequeStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import type { ProjectActor } from "./projects";

export const chequeListQuerySchema = z
  .object({
    q: z.string().trim().max(160).optional(),
    tab: z.enum(["OPEN", "CLOSED", "ALL"]).prefault("OPEN"),
    status: z.nativeEnum(ChequeStatus).optional(),
    branchId: z.string().guid().optional(),
    order: z.enum(["asc", "desc"]).prefault("desc"),
    offset: z.coerce.number().int().min(0).max(10000000).prefault(0),
    limit: z.coerce.number().int().min(1).max(100).prefault(25),
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
              type:true,
              openingAllocations:{take:1,select:{id:true}},
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
  const closedIds = rows
    .filter((row) => Boolean(row.clearedDate))
    .map((row) => row.id);
  const closureNotes = closedIds.length
    ? await db.$queryRaw<
        Array<{ entityId: string; description: string | null }>
      >(Prisma.sql`
    SELECT DISTINCT ON ("entityId") "entityId", metadata->>'description' AS description
    FROM account_operational_audits
    WHERE "companyId"=${actor.companyId}::uuid AND "entityType"='CHEQUE'
      AND "entityId" IN (${Prisma.join(closedIds.map((id) => Prisma.sql`${id}::uuid`))})
      AND "eventType"='CHEQUE_FINANCIAL_ACTION' AND metadata->>'action'='CLOSE'
    ORDER BY "entityId", (metadata->>'version')::bigint DESC NULLS LAST, "createdAt" DESC, id DESC
  `)
    : [];
  const descriptions = new Map(
    closureNotes.map((row) => [row.entityId, row.description]),
  );
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
      sourceTransaction:chequeTransactionTarget(row),
      sourceDocument:
        row.settlement?.allocations.length === 1
          ? {
              id: row.settlement.allocations[0].documentId,
              type: row.settlement.allocations[0].document.type,
            }
          : null,
      moneyAccount: names.get(row.moneyAccountId) ?? null,
      closureDescription: descriptions.get(row.id) ?? null,
    })),
    total,
    offset: query.offset,
    limit: query.limit,
    nextOffset:
      query.offset + rows.length < total ? query.offset + rows.length : null,
  };
}
