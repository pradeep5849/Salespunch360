import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { moneyReadContext } from "./money-context";
import type { ProjectActor } from "./projects";
const blank = (v: unknown) => (v === "" ? undefined : v);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Valid calendar date required",
  );
const query = z
  .object({
    branchId: z.string().guid().optional(),
    scope: z.literal("all").optional(),
    from: z.preprocess(blank, date.optional()),
    to: z.preprocess(blank, date.optional()),
    offset: z.coerce.number().int().min(0).max(1000000).prefault(0),
    limit: z.coerce.number().int().min(1).max(100).prefault(50),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, "Invalid date range");
type HistoryRow = {
  id: string;
  journalNumber: string;
  entryDate: Date;
  reference: string | null;
  narration: string | null;
  sourceType: string;
  status: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  balance: Prisma.Decimal;
};
/** Includes originals and reversal journals; pending operational documents have no ledger effect. */
export async function moneyAccountHistoryForActor(
  actor: ProjectActor,
  id: string,
  raw: unknown = {},
) {
  z.string().guid().parse(id);
  const f = query.parse(raw);
  const resolved = await moneyReadContext(actor, {
    ...(f.branchId ? { branchId: f.branchId } : {}),
    ...(f.scope ? { scope: f.scope } : {}),
  });
  const branch =
    resolved.context.mode === "BRANCH" ? resolved.context.branchId : undefined;
  return db.$transaction(
    async (tx) => {
      const account = await tx.moneyAccount.findFirst({
        where: {
          id,
          companyId: actor.companyId,
          ...(branch ? { OR: [{ branchId: null }, { branchId: branch }] } : {}),
        },
      });
      if (!account) throw new AuthorizationError();
      const branchClause = branch
        ? Prisma.sql`AND j."branchId"=${branch}::uuid`
        : Prisma.empty;
      const base = Prisma.sql`SELECT j.id,j."journalNumber",j."entryDate",j.reference,j.narration,j."sourceType",j.status,j."createdAt",SUM(l.debit) AS debit,SUM(l.credit) AS credit FROM journal_entries j JOIN journal_lines l ON l."journalEntryId"=j.id AND l."companyId"=j."companyId" WHERE j."companyId"=${actor.companyId}::uuid AND l."ledgerAccountId"=${account.ledgerAccountId}::uuid AND j.status IN ('POSTED','REVERSED') ${branchClause} GROUP BY j.id`;
      const from = f.from
        ? Prisma.sql`AND "entryDate">=${new Date(f.from)}::date`
        : Prisma.empty;
      const to = f.to
        ? Prisma.sql`AND "entryDate"<=${new Date(f.to)}::date`
        : Prisma.empty;
      const rows = await tx.$queryRaw<HistoryRow[]>(
        Prisma.sql`WITH postings AS (${base}), balances AS (SELECT *,SUM(debit-credit) OVER (ORDER BY "entryDate","createdAt",id) AS balance FROM postings) SELECT * FROM balances WHERE true ${from} ${to} ORDER BY "entryDate" DESC,"createdAt" DESC,id DESC LIMIT ${f.limit} OFFSET ${f.offset}`,
      );
      const [stats] = await tx.$queryRaw<
        Array<{
          opening: Prisma.Decimal;
          debit: Prisma.Decimal;
          credit: Prisma.Decimal;
          total: bigint;
        }>
      >(
        Prisma.sql`WITH postings AS (${base}) SELECT COALESCE(SUM(debit-credit) FILTER (WHERE ${f.from ? Prisma.sql`"entryDate"<${new Date(f.from)}::date` : Prisma.sql`false`}),0) AS opening,COALESCE(SUM(debit) FILTER (WHERE true ${from} ${to}),0) AS debit,COALESCE(SUM(credit) FILTER (WHERE true ${from} ${to}),0) AS credit,COUNT(*) FILTER (WHERE true ${from} ${to}) AS total FROM postings`,
      );
      return {
        account,
        branchContext: resolved.context,
        from: f.from ?? null,
        to: f.to ?? null,
        offset: f.offset,
        limit: f.limit,
        total: Number(stats.total),
        opening: stats.opening.toFixed(2),
        debit: stats.debit.toFixed(2),
        credit: stats.credit.toFixed(2),
        closing: stats.opening.add(stats.debit).sub(stats.credit).toFixed(2),
        rows: rows.map((row) => ({
          ...row,
          debit: row.debit.toFixed(2),
          credit: row.credit.toFixed(2),
          balance: row.balance.toFixed(2),
        })),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
