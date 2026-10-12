import { retrySerializable } from "./transaction-retry";
import {
  ChequeStatus,
  MoneyAccountType,
  OwnerTransactionType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { allocateDocumentNumberInTx } from "./numbering";
import { canUsePermission } from "@/lib/auth/permissions";
import { postJournalInTx, reverseJournalInTx } from "@/lib/accounting/service";
import type { ProjectActor } from "./projects";
const D = Prisma.Decimal,
  Z = new D(0),
  money = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/);
export { transferLines, loanPaymentLines, ledgerBalance } from "./money-ledger";
import { transferLines, loanPaymentLines } from "./money-ledger";
type Actor = ProjectActor;
async function actor(
  permission:
    "ACCOUNT_MONEY_VIEW" | "ACCOUNT_MONEY_ENTRY" | "ACCOUNT_LOAN_ADMIN",
  mutation = false,
) {
  return (
    mutation
      ? await requirePermissionForMutation(permission)
      : await requirePermission(permission)
  ) as Actor;
}
function branchOk(a: Actor, id: string) {
  if (a.branchAccessScope === "SELECTED_BRANCHES" && !a.branchIds?.includes(id))
    throw new AuthorizationError();
}
function branchScope(a: Actor) {
  return a.branchAccessScope === "SELECTED_BRANCHES"
    ? { branchId: { in: a.branchIds ?? [] } }
    : {};
}
export function manageableMoneyAccountScope(a: Actor) {
  return a.branchAccessScope === "SELECTED_BRANCHES"
    ? { OR: [{ branchId: null }, { branchId: { in: a.branchIds ?? [] } }] }
    : {};
}
export function compatibleMoneyAccount(branchId: string) {
  return { OR: [{ branchId: null }, { branchId }] };
}
async function audit(
  tx: Prisma.TransactionClient,
  a: Actor,
  eventType: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
) {
  await tx.accountOperationalAudit.create({
    data: {
      companyId: a.companyId,
      actorUserId: a.id,
      eventType,
      entityType,
      entityId,
      metadata,
    },
  });
}
async function context(
  tx: Prisma.TransactionClient,
  a: Actor,
  branchId: string,
  date: Date,
) {
  branchOk(a, branchId);
  const [branch, fy] = await Promise.all([
    tx.branch.findFirst({
      where: { id: branchId, companyId: a.companyId, isActive: true },
    }),
    tx.financialYear.findFirst({
      where: {
        companyId: a.companyId,
        isActive: true,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    }),
  ]);
  if (!branch) throw new Error("INVALID_BRANCH");
  if (!fy) throw new Error("INVALID_FINANCIAL_YEAR");
  return fy;
}
const accountInput = z.object({
  type: z.nativeEnum(MoneyAccountType),
  name: z.string().trim().min(1).max(160),
  branchId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().uuid().optional(),
  ),
  bankName: z.string().max(160).optional(),
  accountNumberMasked: z.string().max(40).optional(),
  ifsc: z.string().max(20).optional(),
});
export async function createMoneyAccountForActor(a: Actor, raw: unknown) {
  const d = accountInput.parse(raw);
  if (d.branchId) branchOk(a, d.branchId);
  return db.$transaction(
    async (tx) => {
      if (
        d.branchId &&
        !(await tx.branch.findFirst({
          where: { id: d.branchId, companyId: a.companyId, isActive: true },
        }))
      )
        throw new Error("INVALID_BRANCH");
      const code = await allocateDocumentNumberInTx(tx, {
          companyId: a.companyId,
          branchId:
            d.branchId ??
            (
              await tx.branch.findFirstOrThrow({
                where: {
                  companyId: a.companyId,
                  isActive: true,
                  ...(a.branchAccessScope === "SELECTED_BRANCHES"
                    ? { id: { in: a.branchIds ?? [] } }
                    : {}),
                },
                orderBy: { createdAt: "asc" },
              })
            ).id,
          seriesKey: "MONEY_LEDGER",
          defaults: { prefix: "MA-", padding: 6 },
        }),
        ledger = await tx.ledgerAccount.create({
          data: {
            companyId: a.companyId,
            code,
            name: d.name,
            accountClass: "ASSET",
            normalBalance: "DEBIT",
            isSystem: false,
            allowPosting: true,
          },
        }),
        row = await tx.moneyAccount.create({
          data: { ...d, companyId: a.companyId, ledgerAccountId: ledger.id },
        });
      await audit(tx, a, "MONEY_ACCOUNT_CREATED", "MONEY_ACCOUNT", row.id);
      return row;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function updateMoneyAccountForActor(
  a: Actor,
  id: string,
  raw: unknown,
) {
  const d = accountInput
      .partial()
      .omit({ type: true, branchId: true })
      .parse(raw),
    changed = await db.moneyAccount.updateMany({
      where: { id, companyId: a.companyId, ...manageableMoneyAccountScope(a) },
      data: d,
    });
  if (changed.count !== 1) throw new AuthorizationError();
}
export async function deactivateMoneyAccountForActor(a: Actor, id: string) {
  const changed = await db.moneyAccount.updateMany({
    where: { id, companyId: a.companyId, ...manageableMoneyAccountScope(a) },
    data: { isActive: false },
  });
  if (changed.count !== 1) throw new AuthorizationError();
}
export async function moneyDashboardForActor(a: Actor) {
  const accounts = await db.moneyAccount.findMany({
      where: {
        companyId: a.companyId,
        ...(a.branchAccessScope === "SELECTED_BRANCHES"
          ? {
              OR: [{ branchId: null }, { branchId: { in: a.branchIds ?? [] } }],
            }
          : {}),
      },
    }),
    ids = accounts.map((x) => x.ledgerAccountId),
    lines = await db.journalLine.groupBy({
      by: ["ledgerAccountId"],
      where: {
        companyId: a.companyId,
        ledgerAccountId: { in: ids },
        journalEntry: { status: "POSTED" },
      },
      _sum: { debit: true, credit: true },
    }),
    balances = new Map(
      lines.map((x) => [
        x.ledgerAccountId,
        new D(x._sum.debit ?? 0).sub(x._sum.credit ?? 0),
      ]),
    );
  return {
    accounts: accounts.map((x) => ({
      ...x,
      balance: balances.get(x.ledgerAccountId) ?? Z,
    })),
    transfers: await db.moneyTransfer.findMany({
      where: { companyId: a.companyId, ...branchScope(a) },
      orderBy: { transferDate: "desc" },
      take: 10,
    }),
    loans: await db.loan.findMany({
      where: { companyId: a.companyId, status: "ACTIVE", ...branchScope(a) },
    }),
    advances: await db.accountSettlement.findMany({
      where: {
        companyId: a.companyId,
        type: { in: ["CUSTOMER_ADVANCE", "VENDOR_ADVANCE"] },
        ...branchScope(a),
      },
      orderBy: { transactionDate: "desc" },
      take: 20,
    }),
    owners: await db.ownerFinancialAccount.findMany({
      where: { companyId: a.companyId },
    }),
  };
}
const transferInput = z.object({
  sourceAccountId: z.string().uuid(),
  destinationAccountId: z.string().uuid(),
  branchId: z.string().uuid(),
  amount: money,
  transferDate: z.coerce.date(),
  reference: z.string().max(160).optional(),
  idempotencyKey: z.string().min(8).max(160),
});
export async function createMoneyTransferForActor(a: Actor, raw: unknown) {
  const d = transferInput.parse(raw);
  branchOk(a, d.branchId);
  return retrySerializable(
    () =>
      db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"transfer:" + a.companyId + ":" + d.idempotencyKey}))`;
          const existing = await tx.moneyTransfer.findFirst({
            where: { companyId: a.companyId, idempotencyKey: d.idempotencyKey },
          });
          if (existing) {
            branchOk(a, existing.branchId);
            if (
              existing.branchId !== d.branchId ||
              existing.sourceAccountId !== d.sourceAccountId ||
              existing.destinationAccountId !== d.destinationAccountId ||
              !existing.amount.eq(d.amount) ||
              existing.transferDate.getTime() !== d.transferDate.getTime() ||
              (existing.reference ?? "") !== (d.reference ?? "")
            )
              throw new Error("IDEMPOTENCY_CONFLICT");
            return existing;
          }
          const fy = await context(tx, a, d.branchId, d.transferDate),
            accounts = await tx.moneyAccount.findMany({
              where: {
                companyId: a.companyId,
                id: { in: [d.sourceAccountId, d.destinationAccountId] },
                isActive: true,
                ...compatibleMoneyAccount(d.branchId),
              },
            });
          if (accounts.length !== 2) throw new Error("INVALID_MONEY_ACCOUNT");
          const source = accounts.find((x) => x.id === d.sourceAccountId)!,
            destination = accounts.find(
              (x) => x.id === d.destinationAccountId,
            )!,
            amount = new D(d.amount),
            id = crypto.randomUUID(),
            lines = transferLines(
              source.ledgerAccountId,
              destination.ledgerAccountId,
              amount,
            ),
            journal = await postJournalInTx(tx, a, {
              financialYearId: fy.id,
              branchId: d.branchId,
              entryDate: d.transferDate,
              reference: d.reference,
              sourceType: "MONEY_TRANSFER",
              sourceId: id,
              postingPurpose: "PRIMARY",
              lines: lines.map((x) => ({
                ledgerAccountId: x.ledgerAccountId,
                debit: x.debit.toFixed(2),
                credit: x.credit.toFixed(2),
              })),
            }),
            row = await tx.moneyTransfer.create({
              data: {
                id,
                companyId: a.companyId,
                ...d,
                amount,
                journalEntryId: journal.id,
                createdById: a.id,
              },
            });
          await audit(tx, a, "TRANSFER_POSTED", "MONEY_TRANSFER", row.id, {
            journalEntryId: journal.id,
          });
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    3,
    ["companyId", "idempotencyKey"],
  );
}
const chequeInput = z.object({
  branchId: z.string().uuid(),
  moneyAccountId: z.string().uuid(),
  chequeNumber: z.string().trim().min(1).max(80),
  chequeDate: z.coerce.date(),
  partyName: z.string().trim().min(1).max(240),
  status: z.nativeEnum(ChequeStatus),
  reference: z.string().max(160).optional(),
  journalEntryId: z.string().uuid().optional(),
});
export async function createChequeForActor(a: Actor, raw: unknown) {
  if (!canUsePermission(a, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_ENTRY"))
    throw new AuthorizationError();
  const d = chequeInput.parse(raw);
  if (!["ISSUED", "RECEIVED"].includes(d.status))
    throw new Error("INVALID_CHEQUE_INITIAL_STATUS");
  branchOk(a, d.branchId);
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "companies" WHERE "id"=${a.companyId}::uuid FOR UPDATE`;
        if (
          !(await tx.branch.findFirst({
            where: { id: d.branchId, companyId: a.companyId, isActive: true },
          }))
        )
          throw new AuthorizationError();
        if (
          !(await tx.moneyAccount.findFirst({
            where: {
              id: d.moneyAccountId,
              companyId: a.companyId,
              isActive: true,
              ...compatibleMoneyAccount(d.branchId),
            },
          }))
        )
          throw new Error("INVALID_MONEY_ACCOUNT");
        if (
          d.journalEntryId &&
          !(await tx.journalEntry.findFirst({
            where: {
              id: d.journalEntryId,
              companyId: a.companyId,
              branchId: d.branchId,
              status: "POSTED",
            },
          }))
        )
          throw new Error("INVALID_JOURNAL");
        const existing = await tx.cheque.findFirst({
          where: {
            companyId: a.companyId,
            moneyAccountId: d.moneyAccountId,
            chequeNumber: d.chequeNumber,
          },
        });
        if (existing) {
          branchOk(a, existing.branchId);
          if (
            existing.branchId !== d.branchId ||
            existing.partyName !== d.partyName ||
            existing.status !== d.status ||
            existing.chequeDate.toISOString().slice(0, 10) !==
              d.chequeDate.toISOString().slice(0, 10) ||
            (existing.reference ?? "") !== (d.reference ?? "") ||
            (existing.journalEntryId ?? "") !== (d.journalEntryId ?? "")
          )
            throw new Error("IDEMPOTENCY_CONFLICT");
          return existing;
        }
        const row = await tx.cheque.create({
          data: { ...d, companyId: a.companyId },
        });
        await audit(tx, a, "CHEQUE_CREATED", "CHEQUE", row.id, {
          status: d.status,
          branchId: d.branchId,
          moneyAccountId: d.moneyAccountId,
        });
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
export async function createCheque(raw: unknown) {
  return createChequeForActor(await actor("ACCOUNT_MONEY_ENTRY", true), raw);
}
export async function transitionChequeForActor(
  a: Actor,
  id: string,
  to: ChequeStatus,
  clearedDate?: Date,
) {
  if (!canUsePermission(a, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_ENTRY"))
    throw new AuthorizationError();
  z.string().uuid().parse(id);
  z.nativeEnum(ChequeStatus).parse(to);
  const entryDate =
    clearedDate === undefined ? new Date() : z.coerce.date().parse(clearedDate);
  const dateKey = entryDate.toISOString().slice(0, 10);
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "companies" WHERE "id"=${a.companyId}::uuid FOR UPDATE`;
        const row = await tx.cheque.findFirst({
          where: { id, companyId: a.companyId, ...branchScope(a) },
        });
        if (!row) throw new AuthorizationError();
        if (row.status === to) {
          if (clearedDate) {
            const prior = await tx.accountOperationalAudit.findFirst({
              where: {
                companyId: a.companyId,
                entityType: "CHEQUE",
                entityId: id,
                eventType: "CHEQUE_STATUS_CHANGED",
              },
              orderBy: { createdAt: "desc" },
            });
            const metadata = prior?.metadata as Record<string, unknown> | null;
            if (metadata?.to !== to || metadata?.date !== dateKey)
              throw new Error("IDEMPOTENCY_CONFLICT");
          }
          return row;
        }
        const allowed: Record<ChequeStatus, ChequeStatus[]> = {
          ISSUED: ["CLEARED", "BOUNCED", "CANCELLED"],
          RECEIVED: ["DEPOSITED", "CANCELLED"],
          DEPOSITED: ["CLEARED", "BOUNCED"],
          CLEARED: ["BOUNCED"],
          BOUNCED: [],
          CANCELLED: [],
        };
        if (!allowed[row.status].includes(to))
          throw new Error("INVALID_CHEQUE_TRANSITION");
        if (to === "CLEARED" && !row.journalEntryId)
          throw new Error("CHEQUE_RECEIPT_REQUIRED");
        if (to === "BOUNCED" && row.journalEntryId) {
          if (
            !canUsePermission(
              a,
              "SALESPUNCH360_ACCOUNT",
              "ACCOUNT_JOURNAL_REVERSE",
            )
          )
            throw new AuthorizationError();
          const original = await tx.journalEntry.findFirst({
            where: {
              id: row.journalEntryId,
              companyId: a.companyId,
              branchId: row.branchId,
              status: "POSTED",
            },
          });
          if (!original) throw new Error("INVALID_JOURNAL");
          await reverseJournalInTx(tx, a, {
            journalEntryId: row.journalEntryId,
            entryDate,
            reason: "Cheque bounced",
          });
        }
        const changed = await tx.cheque.updateMany({
          where: {
            id,
            companyId: a.companyId,
            status: row.status,
            ...branchScope(a),
          },
          data: {
            status: to,
            clearedDate: to === "CLEARED" ? entryDate : row.clearedDate,
          },
        });
        if (changed.count !== 1) throw new Error("INVALID_CHEQUE_TRANSITION");
        await audit(tx, a, "CHEQUE_STATUS_CHANGED", "CHEQUE", id, {
          from: row.status,
          to,
          date: dateKey,
        });
        return tx.cheque.findFirstOrThrow({
          where: { id, companyId: a.companyId, ...branchScope(a) },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
export async function transitionCheque(
  id: string,
  to: ChequeStatus,
  clearedDate?: Date,
) {
  return transitionChequeForActor(
    await actor("ACCOUNT_MONEY_ENTRY", true),
    id,
    to,
    clearedDate,
  );
}

async function createLedger(
  tx: Prisma.TransactionClient,
  a: Actor,
  branchId: string,
  name: string,
  accountClass: "EQUITY" | "LIABILITY",
  normalBalance: "DEBIT" | "CREDIT",
) {
  const code = await allocateDocumentNumberInTx(tx, {
    companyId: a.companyId,
    branchId,
    seriesKey: "OWNER_LEDGER",
    defaults: { prefix: "OWN-", padding: 6 },
  });
  return tx.ledgerAccount.create({
    data: {
      companyId: a.companyId,
      code,
      name,
      accountClass,
      normalBalance,
      allowPosting: true,
    },
  });
}
export async function setupOwnerFinancialAccountForActor(
  a: Actor,
  userId: string,
  branchId: string,
) {
  if (a.accountRole !== "ACCOUNT_ADMIN") throw new AuthorizationError();
  branchOk(a, branchId);
  if (
    !(await db.branch.findFirst({
      where: { id: branchId, companyId: a.companyId, isActive: true },
    }))
  )
    throw new AuthorizationError();
  return db.$transaction(
    async (tx) => {
      const existing = await tx.ownerFinancialAccount.findFirst({
        where: { companyId: a.companyId, userId },
      });
      if (existing) return existing;
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          companyId: a.companyId,
          isActive: true,
          OR: [
            { salesRole: "PRIMARY_ADMIN" },
            { accountRole: "ACCOUNT_ADMIN" },
          ],
        },
      });
      if (!user) throw new Error("INVALID_OWNER");
      const [capital, drawings, loan] = await Promise.all([
        createLedger(
          tx,
          a,
          branchId,
          `${user.name} Capital`,
          "EQUITY",
          "CREDIT",
        ),
        createLedger(
          tx,
          a,
          branchId,
          `${user.name} Drawings`,
          "EQUITY",
          "DEBIT",
        ),
        createLedger(
          tx,
          a,
          branchId,
          `${user.name} Loan`,
          "LIABILITY",
          "CREDIT",
        ),
      ]);
      return tx.ownerFinancialAccount.create({
        data: {
          companyId: a.companyId,
          userId,
          capitalLedgerId: capital.id,
          drawingsLedgerId: drawings.id,
          loanLedgerId: loan.id,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
const ownerInput = z.object({
  ownerFinancialAccountId: z.string().uuid(),
  moneyAccountId: z.string().uuid(),
  branchId: z.string().uuid(),
  type: z.nativeEnum(OwnerTransactionType),
  amount: money,
  transactionDate: z.coerce.date(),
  reference: z.string().max(160).optional(),
  idempotencyKey: z.string().min(8).max(160),
});
export async function postOwnerTransactionForActor(a: Actor, raw: unknown) {
  const d = ownerInput.parse(raw);
  branchOk(a, d.branchId);
  if (!new D(d.amount).gt(0)) throw new Error("INVALID_AMOUNT");
  return retrySerializable(
    () =>
      db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"owner:" + a.companyId + ":" + d.idempotencyKey}))`;
          const existing = await tx.ownerTransaction.findFirst({
            where: { companyId: a.companyId, idempotencyKey: d.idempotencyKey },
          });
          if (existing) {
            branchOk(a, existing.branchId);
            if (
              existing.branchId !== d.branchId ||
              existing.ownerFinancialAccountId !== d.ownerFinancialAccountId ||
              existing.moneyAccountId !== d.moneyAccountId ||
              existing.type !== d.type ||
              !existing.amount.eq(d.amount) ||
              existing.transactionDate.getTime() !==
                d.transactionDate.getTime() ||
              (existing.reference ?? "") !== (d.reference ?? "")
            )
              throw new Error("IDEMPOTENCY_CONFLICT");
            return existing;
          }
          const fy = await context(tx, a, d.branchId, d.transactionDate),
            [owner, moneyAccount] = await Promise.all([
              tx.ownerFinancialAccount.findFirst({
                where: {
                  id: d.ownerFinancialAccountId,
                  companyId: a.companyId,
                },
              }),
              tx.moneyAccount.findFirst({
                where: {
                  id: d.moneyAccountId,
                  companyId: a.companyId,
                  isActive: true,
                  ...compatibleMoneyAccount(d.branchId),
                },
              }),
            ]);
          if (!owner || !moneyAccount)
            throw new Error("INVALID_OWNER_TRANSACTION_ACCOUNT");
          if (d.type === "WITHDRAWAL") {
            await tx.$queryRaw`SELECT "id" FROM "money_accounts" WHERE "id"=${moneyAccount.id}::uuid AND "companyId"=${a.companyId}::uuid FOR UPDATE`;
            const funds = await tx.journalLine.aggregate({
              where: {
                companyId: a.companyId,
                ledgerAccountId: moneyAccount.ledgerAccountId,
                journalEntry: { status: { in: ["POSTED", "REVERSED"] } },
              },
              _sum: { debit: true, credit: true },
            });
            if (
              new D(funds._sum.debit ?? 0)
                .sub(funds._sum.credit ?? 0)
                .lt(d.amount)
            )
              throw new Error("INSUFFICIENT_MONEY_BALANCE");
          }
          const amount = new D(d.amount),
            ownerLedger =
              d.type === "INVESTMENT"
                ? owner.capitalLedgerId
                : d.type === "WITHDRAWAL"
                  ? owner.drawingsLedgerId
                  : owner.loanLedgerId,
            incoming = d.type !== "WITHDRAWAL",
            id = crypto.randomUUID(),
            journal = await postJournalInTx(tx, a, {
              financialYearId: fy.id,
              branchId: d.branchId,
              entryDate: d.transactionDate,
              reference: d.reference,
              sourceType: d.type,
              sourceId: id,
              postingPurpose: "PRIMARY",
              lines: [
                {
                  ledgerAccountId: moneyAccount.ledgerAccountId,
                  debit: incoming ? amount.toFixed(2) : "0",
                  credit: incoming ? "0" : amount.toFixed(2),
                },
                {
                  ledgerAccountId: ownerLedger,
                  debit: incoming ? "0" : amount.toFixed(2),
                  credit: incoming ? amount.toFixed(2) : "0",
                },
              ],
            }),
            row = await tx.ownerTransaction.create({
              data: {
                id,
                companyId: a.companyId,
                ...d,
                amount,
                journalEntryId: journal.id,
                createdById: a.id,
              },
            });
          await audit(
            tx,
            a,
            (
              {
                INVESTMENT: "OWNER_INVESTMENT_POSTED",
                WITHDRAWAL: "OWNER_WITHDRAWAL_POSTED",
                OWNER_LOAN: "OWNER_LOAN_POSTED",
              } as const
            )[d.type],
            "OWNER_TRANSACTION",
            row.id,
          );
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    3,
    ["companyId", "idempotencyKey"],
  );
}
const loanInput = z.object({
  branchId: z.string().uuid(),
  lender: z.string().trim().min(1).max(240),
  loanType: z.string().trim().min(1).max(80),
  principal: money,
  interestRate: z.preprocess(
    (value) => (value === "" ? undefined : value),
    money.optional(),
  ),
  startDate: z.coerce.date(),
  maturityDate: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.date().optional(),
  ),
  moneyAccountId: z.string().uuid(),
  reference: z.string().max(160).optional(),
  idempotencyKey: z.string().min(8).max(160),
});
export async function createAndReceiveLoanForActor(a: Actor, raw: unknown) {
  const d = loanInput.parse(raw);
  branchOk(a, d.branchId);
  if (!new D(d.principal).gt(0)) throw new Error("INVALID_AMOUNT");
  return retrySerializable(
    () =>
      db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"loan:" + a.companyId + ":" + d.idempotencyKey}))`;
          const existing = await tx.loan.findFirst({
            where: { companyId: a.companyId, idempotencyKey: d.idempotencyKey },
          });
          if (existing) {
            branchOk(a, existing.branchId);
            if (
              existing.branchId !== d.branchId ||
              existing.moneyAccountId !== d.moneyAccountId ||
              existing.lender !== d.lender ||
              existing.loanType !== d.loanType ||
              !existing.principal.eq(d.principal) ||
              !new D(existing.interestRate ?? 0).eq(d.interestRate ?? 0) ||
              existing.startDate.getTime() !== d.startDate.getTime() ||
              (existing.maturityDate?.getTime() ?? null) !==
                (d.maturityDate?.getTime() ?? null) ||
              (existing.reference ?? "") !== (d.reference ?? "")
            )
              throw new Error("IDEMPOTENCY_CONFLICT");
            return existing;
          }
          const fy = await context(tx, a, d.branchId, d.startDate),
            moneyAccount = await tx.moneyAccount.findFirst({
              where: {
                id: d.moneyAccountId,
                companyId: a.companyId,
                isActive: true,
                ...compatibleMoneyAccount(d.branchId),
              },
            });
          if (!moneyAccount) throw new Error("INVALID_MONEY_ACCOUNT");
          const liability = await createLedger(
              tx,
              a,
              d.branchId,
              `${d.lender} Loan`,
              "LIABILITY",
              "CREDIT",
            ),
            id = crypto.randomUUID(),
            principal = new D(d.principal),
            journal = await postJournalInTx(tx, a, {
              financialYearId: fy.id,
              branchId: d.branchId,
              entryDate: d.startDate,
              reference: d.reference,
              sourceType: "LOAN_RECEIPT",
              sourceId: id,
              postingPurpose: "PRIMARY",
              lines: [
                {
                  ledgerAccountId: moneyAccount.ledgerAccountId,
                  debit: principal.toFixed(2),
                  credit: "0",
                },
                {
                  ledgerAccountId: liability.id,
                  debit: "0",
                  credit: principal.toFixed(2),
                },
              ],
            }),
            row = await tx.loan.create({
              data: {
                id,
                companyId: a.companyId,
                ...d,
                principal,
                interestRate: d.interestRate ? new D(d.interestRate) : null,
                liabilityLedgerId: liability.id,
                receivedJournalId: journal.id,
                createdById: a.id,
              },
            });
          await audit(tx, a, "LOAN_RECEIVED", "LOAN", id, {
            journalEntryId: journal.id,
          });
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    3,
    ["companyId", "idempotencyKey"],
  );
}
const paymentInput = z.object({
  loanId: z.string().uuid(),
  moneyAccountId: z.string().uuid(),
  paymentDate: z.coerce.date(),
  principal: money,
  tax: z.never().optional(),
  interest: money,
  charges: money.default("0"),
  idempotencyKey: z.string().min(8).max(160),
});
export async function postLoanPaymentForActor(a: Actor, raw: unknown) {
  const d = paymentInput.parse(raw);
  if (!new D(d.principal).add(d.interest).add(d.charges).gt(0))
    throw new Error("INVALID_AMOUNT");
  return retrySerializable(
    () =>
      db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"loan-payment:" + a.companyId + ":" + d.idempotencyKey}))`;
          const existing = await tx.loanPayment.findFirst({
            where: { companyId: a.companyId, idempotencyKey: d.idempotencyKey },
          });
          if (existing) {
            const source = await tx.loan.findFirst({
              where: { id: existing.loanId, companyId: a.companyId },
            });
            if (!source) throw new AuthorizationError();
            branchOk(a, source.branchId);
            if (
              existing.loanId !== d.loanId ||
              existing.moneyAccountId !== d.moneyAccountId ||
              existing.paymentDate.getTime() !== d.paymentDate.getTime() ||
              !existing.principal.eq(d.principal) ||
              !existing.interest.eq(d.interest) ||
              !existing.charges.eq(d.charges)
            )
              throw new Error("IDEMPOTENCY_CONFLICT");
            return existing;
          }
          await tx.$queryRaw`SELECT "id" FROM "loans" WHERE "id"=${d.loanId}::uuid AND "companyId"=${a.companyId}::uuid FOR UPDATE`;
          const loan = await tx.loan.findFirst({
            where: { id: d.loanId, companyId: a.companyId, status: "ACTIVE" },
          });
          if (!loan) throw new Error("INVALID_LOAN");
          const fy = await context(tx, a, loan.branchId, d.paymentDate),
            moneyAccount = await tx.moneyAccount.findFirst({
              where: {
                id: d.moneyAccountId,
                companyId: a.companyId,
                isActive: true,
                ...compatibleMoneyAccount(loan.branchId),
              },
            }),
            accounts = await tx.ledgerAccount.findMany({
              where: {
                companyId: a.companyId,
                systemKey: { in: ["GENERAL_EXPENSES"] },
              },
            });
          if (!moneyAccount) throw new Error("INVALID_MONEY_ACCOUNT");
          const paid = await tx.loanPayment.aggregate({
              where: { companyId: a.companyId, loanId: loan.id },
              _sum: { principal: true },
            }),
            principal = new D(d.principal),
            interest = new D(d.interest),
            charges = new D(d.charges),
            outstanding = loan.principal.sub(paid._sum.principal ?? 0);
          if (principal.gt(outstanding))
            throw new Error("PRINCIPAL_EXCEEDS_OUTSTANDING");
          const expense = accounts[0]?.id;
          if (!expense && (interest.gt(0) || charges.gt(0)))
            throw new Error("INTEREST_LEDGER_MISSING");
          const id = crypto.randomUUID(),
            lines = loanPaymentLines(
              loan.liabilityLedgerId,
              expense!,
              expense!,
              moneyAccount.ledgerAccountId,
              principal,
              interest,
              charges,
            ),
            journal = await postJournalInTx(tx, a, {
              financialYearId: fy.id,
              branchId: loan.branchId,
              entryDate: d.paymentDate,
              sourceType: "LOAN_PAYMENT",
              sourceId: id,
              postingPurpose: "PRIMARY",
              lines: lines
                .filter((x) => x.debit.gt(0) || x.credit.gt(0))
                .map((x) => ({
                  ledgerAccountId: x.ledgerAccountId,
                  debit: x.debit.toFixed(2),
                  credit: x.credit.toFixed(2),
                })),
            }),
            row = await tx.loanPayment.create({
              data: {
                id,
                companyId: a.companyId,
                ...d,
                principal,
                interest,
                charges,
                journalEntryId: journal.id,
              },
            });
          if (principal.eq(outstanding))
            await tx.loan.update({
              where: { id: loan.id },
              data: { status: "PAID_OFF" },
            });
          await audit(tx, a, "LOAN_PAYMENT_POSTED", "LOAN_PAYMENT", id, {
            journalEntryId: journal.id,
          });
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    3,
    ["companyId", "idempotencyKey"],
  );
}
export async function listMoneyDataForActor(a: Actor) {
  return {
    dashboard: await moneyDashboardForActor(a),
    cheques: await db.cheque.findMany({
      where: { companyId: a.companyId, ...branchScope(a) },
      orderBy: { chequeDate: "desc" },
    }),
    owners: await db.ownerFinancialAccount.findMany({
      where: { companyId: a.companyId },
    }),
    loans: await db.loan.findMany({
      where: { companyId: a.companyId, ...branchScope(a) },
      orderBy: { startDate: "desc" },
    }),
    users: await db.user.findMany({
      where: {
        companyId: a.companyId,
        isActive: true,
        OR: [{ salesRole: "PRIMARY_ADMIN" }, { accountRole: "ACCOUNT_ADMIN" }],
      },
    }),
    branches: await db.branch.findMany({
      where: {
        companyId: a.companyId,
        isActive: true,
        ...(a.branchAccessScope === "SELECTED_BRANCHES"
          ? { id: { in: a.branchIds ?? [] } }
          : {}),
      },
    }),
  };
}

export async function createMoneyAccount(raw: unknown) {
  return createMoneyAccountForActor(
    await actor("ACCOUNT_MONEY_ENTRY", true),
    raw,
  );
}
export async function updateMoneyAccount(id: string, raw: unknown) {
  return updateMoneyAccountForActor(
    await actor("ACCOUNT_MONEY_ENTRY", true),
    id,
    raw,
  );
}
export async function deactivateMoneyAccount(id: string) {
  return deactivateMoneyAccountForActor(
    await actor("ACCOUNT_MONEY_ENTRY", true),
    id,
  );
}
export async function moneyDashboard() {
  return moneyDashboardForActor(await actor("ACCOUNT_MONEY_VIEW"));
}
export async function createMoneyTransfer(raw: unknown) {
  return createMoneyTransferForActor(
    await actor("ACCOUNT_MONEY_ENTRY", true),
    raw,
  );
}
export async function postOwnerTransaction(raw: unknown) {
  return postOwnerTransactionForActor(
    await actor("ACCOUNT_LOAN_ADMIN", true),
    raw,
  );
}
export async function createAndReceiveLoan(raw: unknown) {
  return createAndReceiveLoanForActor(
    await actor("ACCOUNT_LOAN_ADMIN", true),
    raw,
  );
}
export async function postLoanPayment(raw: unknown) {
  return postLoanPaymentForActor(await actor("ACCOUNT_LOAN_ADMIN", true), raw);
}
export async function listMoneyData() {
  return listMoneyDataForActor(await actor("ACCOUNT_MONEY_VIEW"));
}

export async function setupOwnerFinancialAccount(
  userId: string,
  branchId: string,
) {
  return setupOwnerFinancialAccountForActor(
    await actor("ACCOUNT_LOAN_ADMIN", true),
    userId,
    branchId,
  );
}
