import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import type { ProjectActor } from "./projects";
const blank = (value: unknown) => (value === "" ? undefined : value);
const calendarDate = z.union([
  z.date(),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(value);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Enter a valid calendar date")
    .transform((value) => new Date(value)),
]);
const filters = z
  .object({
    from: z.preprocess(blank, calendarDate.optional()),
    to: z.preprocess(blank, calendarDate.optional()),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export async function ownerHistoryForActor(
  actor: ProjectActor,
  id: string,
  raw: unknown = {},
) {
  if (
    !actor.isActive ||
    !actor.accountAccessActive ||
    !["ACCOUNT_ADMIN", "ACCOUNTANT"].includes(actor.accountRole ?? "")
  )
    throw new AuthorizationError();
  z.string().uuid().parse(id);
  const f = filters.parse(raw);
  if (f.from && f.to && f.from > f.to) throw new Error("INVALID_DATE_RANGE");
  const owner = await db.ownerFinancialAccount.findFirst({
    where: { id, companyId: actor.companyId },
    select: {
      id: true,
      name: true,
      partyType: true,
      isActive: true,
      phone: true,
      email: true,
      address: true,
    },
  });
  if (!owner) throw new AuthorizationError();
  const where = {
    companyId: actor.companyId,
    ownerFinancialAccountId: id,
    ...(actor.branchAccessScope === "SELECTED_BRANCHES"
      ? { branchId: { in: actor.branchIds ?? [] } }
      : {}),
    ...(f.from || f.to
      ? {
          transactionDate: {
            ...(f.from ? { gte: f.from } : {}),
            ...(f.to ? { lte: f.to } : {}),
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.ownerTransaction.findMany({
      where,
      orderBy: [
        { transactionDate: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: f.offset,
      take: f.limit,
    }),
    db.ownerTransaction.count({ where }),
  ]);
  const [journals, accounts] = await Promise.all([
    db.journalEntry.findMany({
      where: {
        companyId: actor.companyId,
        id: { in: rows.map((row) => row.journalEntryId) },
      },
      select: {
        id: true,
        status: true,
        reversedBy: {
          select: { id: true, entryDate: true, reversalReason: true },
        },
      },
    }),
    db.moneyAccount.findMany({
      where: {
        companyId: actor.companyId,
        id: { in: rows.map((row) => row.moneyAccountId) },
      },
      select: { id: true, name: true },
    }),
  ]);
  const journalById = new Map(journals.map((row) => [row.id, row])),
    accountNames = new Map(accounts.map((row) => [row.id, row.name]));
  return {
    owner,
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount.toFixed(2),
      transactionDate: row.transactionDate.toISOString().slice(0, 10),
      reference: row.reference,
      moneyAccountName:
        accountNames.get(row.moneyAccountId) ?? "Unavailable account",
      journalStatus:
        journalById.get(row.journalEntryId)?.status ?? "UNAVAILABLE",
      reversal: journalById.get(row.journalEntryId)?.reversedBy
        ? {
            date: journalById
              .get(row.journalEntryId)!
              .reversedBy!.entryDate.toISOString()
              .slice(0, 10),
            reason: journalById.get(row.journalEntryId)!.reversedBy!
              .reversalReason,
          }
        : null,
    })),
    total,
    hasMore: f.offset + rows.length < total,
    offset: f.offset,
    limit: f.limit,
  };
}
