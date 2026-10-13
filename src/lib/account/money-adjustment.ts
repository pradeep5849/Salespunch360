import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { postJournalInTx } from "@/lib/accounting/service";
import { journalMatchesInput } from "@/lib/accounting/journal-replay";
import { LEDGER_EFFECTIVE_JOURNAL_STATUSES } from "@/lib/accounting/ledger-policy";
import { retrySerializable } from "./transaction-retry";
import type { ProjectActor } from "./projects";
const input = z
  .object({
    moneyAccountId: z.string().uuid(),
    branchId: z.string().uuid(),
    direction: z.enum(["ADD", "REDUCE"]),
    offsetLedgerId: z.string().uuid(),
    amount: z
      .string()
      .regex(/^\d{1,16}(\.\d{1,2})?$/)
      .refine((v) => new Prisma.Decimal(v).gt(0), "Positive amount required"),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (v) =>
          !Number.isNaN(Date.parse(v)) &&
          new Date(v).toISOString().slice(0, 10) === v,
        "Valid calendar date required",
      ),
    reason: z.string().trim().min(3).max(1000),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export async function postMoneyAdjustmentForActor(
  a: ProjectActor,
  raw: unknown,
) {
  const d = input.parse(raw);
  if (!canUsePermission(a, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_ENTRY"))
    throw new AuthorizationError();
  if (
    a.branchAccessScope === "SELECTED_BRANCHES" &&
    !a.branchIds?.includes(d.branchId)
  )
    throw new AuthorizationError();
  return retrySerializable(
    () =>
      db.$transaction(
        async (tx) => {
          // Same financial company lock as journals, transfers, receipts and period locks.
          await tx.$queryRaw`SELECT 1 FROM companies WHERE id=${a.companyId}::uuid FOR UPDATE`;
          const account = await tx.moneyAccount.findFirst({
            where: {
              id: d.moneyAccountId,
              companyId: a.companyId,
              OR: [{ branchId: null }, { branchId: d.branchId }],
            },
          });
          if (!account) throw new AuthorizationError();
          const existing = await tx.journalEntry.findFirst({
            where: {
              companyId: a.companyId,
              sourceType: "MONEY_ADJUSTMENT",
              sourceId: d.idempotencyKey,
              postingPurpose: "PRIMARY",
            },
            include: { lines: { orderBy: { lineNumber: "asc" } } },
          });
          const date = new Date(d.date);
          const fy = existing
            ? { id: existing.financialYearId }
            : await tx.financialYear.findFirst({
                where: {
                  companyId: a.companyId,
                  isActive: true,
                  startDate: { lte: date },
                  endDate: { gte: date },
                },
              });
          if (!fy) throw new Error("INVALID_FINANCIAL_YEAR");
          const amount = new Prisma.Decimal(d.amount).toFixed(2),
            incoming = d.direction === "ADD";
          const posting = {
            financialYearId: fy.id,
            branchId: d.branchId,
            entryDate: date,
            sourceType: "MONEY_ADJUSTMENT",
            sourceId: d.idempotencyKey,
            postingPurpose: "PRIMARY",
            narration: d.reason,
            lines: [
              {
                ledgerAccountId: account.ledgerAccountId,
                debit: incoming ? amount : "0",
                credit: incoming ? "0" : amount,
              },
              {
                ledgerAccountId: d.offsetLedgerId,
                debit: incoming ? "0" : amount,
                credit: incoming ? amount : "0",
              },
            ],
          };
          if (existing) {
            if (
              !journalMatchesInput(existing, posting) ||
              !["POSTED", "REVERSED"].includes(existing.status)
            )
              throw new Error("IDEMPOTENCY_CONFLICT");
            return existing;
          }
          if (!account.isActive) throw new Error("INVALID_MONEY_ACCOUNT");
          const offset = await tx.ledgerAccount.findFirst({
            where: {
              id: d.offsetLedgerId,
              companyId: a.companyId,
              isActive: true,
              allowPosting: true,
              accountClass: { in: ["EQUITY", "INCOME", "EXPENSE"] },
              OR: [
                { isSystem: false },
                { systemKey: { in: ["GENERAL_EXPENSES", "OTHER_INCOME"] } },
              ],
            },
          });
          // Owner movements must keep their owner subledger; use Capital & Drawings instead.
          const owner = await tx.ownerFinancialAccount.findFirst({
            where: {
              companyId: a.companyId,
              OR: [
                { capitalLedgerId: d.offsetLedgerId },
                { drawingsLedgerId: d.offsetLedgerId },
                { loanLedgerId: d.offsetLedgerId },
              ],
            },
          });
          if (!offset || owner) throw new Error("INVALID_LEDGER_ACCOUNT");
          if (!incoming && account.type !== "BANK") {
            const totals = await tx.journalLine.aggregate({
              where: {
                companyId: a.companyId,
                ledgerAccountId: account.ledgerAccountId,
                journalEntry: {
                  status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
                },
              },
              _sum: { debit: true, credit: true },
            });
            if (
              new Prisma.Decimal(totals._sum.debit ?? 0)
                .sub(totals._sum.credit ?? 0)
                .lt(amount)
            )
              throw new Error("INSUFFICIENT_MONEY_BALANCE");
          }
          const journal = await postJournalInTx(tx, a, posting);
          await tx.accountOperationalAudit.create({
            data: {
              companyId: a.companyId,
              actorUserId: a.id,
              eventType: "MONEY_ADJUSTMENT_POSTED",
              entityType: "MONEY_ACCOUNT",
              entityId: account.id,
              metadata: {
                journalEntryId: journal.id,
                direction: d.direction,
                offsetLedgerId: d.offsetLedgerId,
                reason: d.reason,
                amount,
              },
            },
          });
          return journal;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      ),
    3,
  );
}
export async function moneyAdjustmentOptionsForActor(a: ProjectActor) {
  if (!canUsePermission(a, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_ENTRY"))
    throw new AuthorizationError();
  const owners = await db.ownerFinancialAccount.findMany({
    where: { companyId: a.companyId },
    select: {
      capitalLedgerId: true,
      drawingsLedgerId: true,
      loanLedgerId: true,
    },
  });
  const excluded = owners.flatMap((o) => [
    o.capitalLedgerId,
    o.drawingsLedgerId,
    o.loanLedgerId,
  ]);
  const [ledgers, branches] = await Promise.all([
    db.ledgerAccount.findMany({
      where: {
        companyId: a.companyId,
        id: { notIn: excluded },
        isActive: true,
        allowPosting: true,
        accountClass: { in: ["EQUITY", "INCOME", "EXPENSE"] },
        OR: [
          { isSystem: false },
          { systemKey: { in: ["GENERAL_EXPENSES", "OTHER_INCOME"] } },
        ],
      },
      select: { id: true, name: true, accountClass: true },
      orderBy: { name: "asc" },
    }),
    db.branch.findMany({
      where: {
        companyId: a.companyId,
        isActive: true,
        ...(a.branchAccessScope === "SELECTED_BRANCHES"
          ? { id: { in: a.branchIds ?? [] } }
          : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { ledgers, branches };
}
