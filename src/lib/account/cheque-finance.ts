import { createHash } from "node:crypto";
import { Prisma, type AccountSettlement, type Cheque } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { reverseJournalInTx } from "@/lib/accounting/service";
import { parseIndiaBusinessDate } from "@/lib/follow-up-tasks/date";
import { createSettlementForActor } from "./commercial";
import { retrySerializable } from "./transaction-retry";
import type { ProjectActor } from "./projects";

const actionFields = {
  requestKey: z.string().uuid(),
  expectedVersion: z.number().int().min(0).max(2147483646),
  actionDate: z.string().date(),
};
export const chequeFinancialActionInput = z.discriminatedUnion("action", [
  z
    .object({
      ...actionFields,
      action: z.literal("CLOSE"),
      moneyAccountId: z.string().uuid().optional(),
    })
    .strict(),
  z
    .object({
      ...actionFields,
      action: z.literal("REOPEN"),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      ...actionFields,
      action: z.literal("BOUNCE"),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      ...actionFields,
      action: z.literal("CANCEL"),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
]);
function branchAllowed(a: ProjectActor, branchId: string) {
  if (
    a.branchAccessScope === "SELECTED_BRANCHES" &&
    !a.branchIds?.includes(branchId)
  )
    throw new AuthorizationError();
}
async function sourceRequest(
  tx: Prisma.TransactionClient,
  row: Cheque,
  source: AccountSettlement,
  date: Date,
  bankId: string,
  key: string,
) {
  const [allocations, opening] = await Promise.all([
    tx.settlementAllocation.findMany({
      where: { companyId: row.companyId, settlementId: source.id },
    }),
    tx.openingBalanceAllocation.findMany({
      where: { companyId: row.companyId, settlementId: source.id },
    }),
  ]);
  return {
    idempotencyKey: key,
    type: source.type,
    branchId: source.branchId,
    partyId: source.partyId,
    projectId: source.projectId ?? undefined,
    amount: source.amount.toFixed(2),
    paymentMode: "CHEQUE",
    moneyAccountId: bankId,
    transactionDate: date,
    reference: source.reference ?? undefined,
    notes: source.notes ?? undefined,
    chequeNumber: row.chequeNumber,
    chequeDate: row.chequeDate,
    allocations: [
      ...allocations.map((x) => ({
        documentId: x.documentId,
        amount: x.amount.toFixed(2),
        discountAmount: x.discountAmount.toFixed(2),
      })),
      ...opening.map((x) => ({
        openingBalanceId: x.openingBalanceId,
        amount: x.amount.toFixed(2),
        discountAmount: "0",
      })),
    ],
  };
}
async function reverseSettlementInTx(
  tx: Prisma.TransactionClient,
  a: ProjectActor,
  source: AccountSettlement,
  date: Date,
  reason: string,
) {
  if (source.status !== "POSTED" || !source.journalEntryId)
    throw new Error("INVALID_CHEQUE_SOURCE");
  if (date < source.transactionDate)
    throw new Error("INVALID_CHEQUE_CORRECTION_DATE");
  const applications = await tx.advanceApplication.findMany({
    where: {
      companyId: a.companyId,
      advanceId: source.id,
      journalEntry: { status: "POSTED" },
    },
    include: { document: { select: { branchId: true } } },
  });
  for (const application of applications) {
    branchAllowed(a, application.document.branchId);
    await reverseJournalInTx(
      tx,
      a,
      { journalEntryId: application.journalEntryId, entryDate: date, reason },
      { advanceApplicationId: application.id },
    );
  }
  await reverseJournalInTx(
    tx,
    a,
    { journalEntryId: source.journalEntryId, entryDate: date, reason },
    { settlementId: source.id },
  );
  await tx.$executeRaw`SELECT set_config('app.financial_reversal_company_id', ${a.companyId}, true)`;
  await tx.accountSettlement.update({
    where: { id: source.id },
    data: { status: "REVERSED", remainingAmount: 0 },
  });
}
export async function chequeFinancialActionForActor(
  a: ProjectActor,
  id: string,
  raw: unknown,
) {
  if (!canUsePermission(a, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_ENTRY"))
    throw new AuthorizationError();
  z.string().uuid().parse(id);
  const input = chequeFinancialActionInput.parse(raw);
  if (
    input.action !== "CLOSE" &&
    !canUsePermission(a, "SALESPUNCH360_ACCOUNT", "ACCOUNT_JOURNAL_REVERSE")
  )
    throw new AuthorizationError();
  const date = parseIndiaBusinessDate(input.actionDate);
  const hash = createHash("sha256")
    .update(JSON.stringify({ id, ...input }))
    .digest("hex");
  return retrySerializable(
    () =>
      db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${a.companyId}::uuid FOR UPDATE`;
          let row = await tx.cheque.findFirst({
            where: { id, companyId: a.companyId },
          });
          if (!row) throw new AuthorizationError();
          branchAllowed(a, row.branchId);
          const prior = await tx.accountOperationalAudit.findFirst({
            where: {
              companyId: a.companyId,
              eventType: "CHEQUE_FINANCIAL_ACTION",
              metadata: { path: ["requestKey"], equals: input.requestKey },
            },
          });
          if (prior) {
            const metadata = prior.metadata as { requestHash?: string } | null;
            if (prior.entityId !== id || metadata?.requestHash !== hash)
              throw new Error("IDEMPOTENCY_KEY_REUSED");
            return row;
          }
          if (row.actionVersion !== input.expectedVersion)
            throw new Error("CHEQUE_CHANGED");
          if (!row.settlementId || !row.amount)
            throw new Error("LEGACY_CHEQUE_SOURCE_REQUIRED");
          let source = await tx.accountSettlement.findFirst({
            where: {
              id: row.settlementId,
              companyId: a.companyId,
              branchId: row.branchId,
              chequeId: row.id,
            },
          });
          if (!source || !source.amount.eq(row.amount))
            throw new Error("INVALID_CHEQUE_SOURCE");
          const wasOpen = ["ISSUED", "RECEIVED"].includes(row.status);
          let status: Cheque["status"];
          if (input.action === "CLOSE") {
            if (!wasOpen) throw new Error("INVALID_CHEQUE_TRANSITION");
            if (date < row.chequeDate) throw new Error("CHEQUE_NOT_DUE");
            const bankId = input.moneyAccountId ?? row.moneyAccountId;
            if (source.status === "REVERSED") {
              source = await createSettlementForActor(
                a,
                await sourceRequest(
                  tx,
                  row,
                  source,
                  date,
                  bankId,
                  `cheque:${id}:${input.requestKey}`,
                ),
                tx,
                { reuseChequeId: id },
              );
              row = { ...row, settlementId: source.id };
            }
            if (source.status !== "PENDING_CHEQUE")
              throw new Error("INVALID_CHEQUE_SOURCE");
            const posted = await createSettlementForActor(
              a,
              await sourceRequest(
                tx,
                row,
                source,
                date,
                bankId,
                source.idempotencyKey,
              ),
              tx,
              { closeChequeId: id },
            );
            if (!posted.journalEntryId || posted.status !== "POSTED")
              throw new Error("INVALID_CHEQUE_SOURCE");
            status = "CLEARED";
            await tx.cheque.update({
              where: { id },
              data: {
                journalEntryId: posted.journalEntryId,
                clearedDate: date,
                moneyAccountId: bankId,
                settlementId: posted.id,
              },
            });
          } else {
            if (
              input.action === "REOPEN" &&
              !["CLEARED", "DEPOSITED", "BOUNCED"].includes(row.status)
            )
              throw new Error("INVALID_CHEQUE_TRANSITION");
            if (
              input.action !== "REOPEN" &&
              ["BOUNCED", "CANCELLED"].includes(row.status)
            )
              throw new Error("INVALID_CHEQUE_TRANSITION");
            if (source.status === "POSTED")
              await reverseSettlementInTx(tx, a, source, date, input.reason);
            else if (
              source.status !== "PENDING_CHEQUE" &&
              source.status !== "REVERSED"
            )
              throw new Error("INVALID_CHEQUE_SOURCE");
            status =
              input.action === "REOPEN"
                ? source.type.startsWith("CUSTOMER")
                  ? "RECEIVED"
                  : "ISSUED"
                : input.action === "BOUNCE"
                  ? "BOUNCED"
                  : "CANCELLED";
            await tx.cheque.update({
              where: { id },
              data: { journalEntryId: null, clearedDate: null },
            });
          }
          const updated = await tx.cheque.update({
            where: { id },
            data: { status, actionVersion: { increment: 1 } },
          });
          await tx.accountOperationalAudit.create({
            data: {
              companyId: a.companyId,
              actorUserId: a.id,
              entityType: "CHEQUE",
              entityId: id,
              eventType: "CHEQUE_FINANCIAL_ACTION",
              metadata: {
                requestKey: input.requestKey,
                requestHash: hash,
                action: input.action,
                actionDate: input.actionDate,
                version: updated.actionVersion,
                settlementId: updated.settlementId,
                ...(input.action !== "CLOSE" ? { reason: input.reason } : {}),
              },
            },
          });
          return updated;
        },
        { isolationLevel: "Serializable" },
      ),
    4,
  );
}
