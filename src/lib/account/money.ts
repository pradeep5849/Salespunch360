import {loanCreationFingerprint} from "./loan-fingerprint";
import {moneyBankMetadata,bankIfsc,hasBankMetadata} from "./money-bank-metadata";
import { moneyReadContext } from "./money-context";
import { createSettlementForActor } from "./commercial";
import { EFFECTIVE_SETTLEMENT } from "./settlement-policy";
import { createHash } from "node:crypto";
import { LEDGER_EFFECTIVE_JOURNAL_STATUSES } from "@/lib/accounting/ledger-policy";
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
import { postJournalInTx } from "@/lib/accounting/service";
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
  ...moneyBankMetadata.shape,
  type: z.nativeEnum(MoneyAccountType),
  name: z.string().trim().min(1).max(160),
  branchId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().uuid().optional(),
  ),
  bankName: z.string().max(160).optional(),
  accountNumberMasked: z.string().max(40).optional(),
  ifsc: bankIfsc,
});
async function allocateMoneyLedgerCodeInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
) {
  // Ledger codes belong to a company even when the money account belongs to a branch.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId + ":money-ledger-code"}))`;
  const [maximum] = await tx.$queryRaw<
    Array<{ next: Prisma.Decimal }>
  >`SELECT (COALESCE(MAX(SUBSTRING(code FROM 4)::numeric),0)+1)::numeric AS next FROM ledger_accounts WHERE "companyId"=${companyId}::uuid AND code ~ '^MA-[0-9]+$'`;
  const next = BigInt(maximum.next.toFixed(0));
  if (next > BigInt("9223372036854775807"))
    throw new Error("MONEY_LEDGER_NUMBER_EXHAUSTED");
  let series = await tx.numberingSeries.findFirst({
    where: { companyId, branchId: null, seriesKey: "MONEY_LEDGER_GLOBAL" },
  });
  if (!series)
    series = await tx.numberingSeries.create({
      data: {
        companyId,
        branchId: null,
        seriesKey: "MONEY_LEDGER_GLOBAL",
        prefix: "MA-",
        padding: 6,
        nextSequence: next,
      },
    });
  else if (series.nextSequence < next)
    series = await tx.numberingSeries.update({
      where: { id: series.id },
      data: { nextSequence: next },
    });
  return allocateDocumentNumberInTx(tx, { companyId, seriesId: series.id });
}
export async function createMoneyAccountForActor(a: Actor, raw: unknown) {
  const {
    creationRequestKey,
    openingBalance,
    openingDate,
    openingBranchId,
    ...d
  } = accountInput
    .extend({
      creationRequestKey: z.string().uuid().optional(),
      openingBalance: z
        .preprocess(
          (v) => (v === "" || v == null ? "0" : v),
          z.string().regex(/^-?\d{1,16}(\.\d{1,2})?$/),
        )
        .default("0"),
      openingDate: z.preprocess(
        (v) => (v === "" ? undefined : v),
        z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .refine(
            (v) =>
              !Number.isNaN(Date.parse(v)) &&
              new Date(v).toISOString().slice(0, 10) === v,
            "Valid calendar date required",
          )
          .optional(),
      ),
      openingBranchId: z.preprocess(
        (v) => (v === "" ? undefined : v),
        z.string().uuid().optional(),
      ),
    })
    .superRefine((v, c) => {
      if (!new D(v.openingBalance).isZero()) {
        if (!v.creationRequestKey)
          c.addIssue({
            code: "custom",
            path: ["creationRequestKey"],
            message: "Opening balances require a retry key",
          });
        if (!v.openingDate)
          c.addIssue({
            code: "custom",
            path: ["openingDate"],
            message: "Opening balance date required",
          });
        if (!v.branchId && !v.openingBranchId)
          c.addIssue({
            code: "custom",
            path: ["openingBranchId"],
            message: "Select the opening journal branch",
          });
        if (v.branchId && v.openingBranchId && v.branchId !== v.openingBranchId)
          c.addIssue({
            code: "custom",
            path: ["openingBranchId"],
            message: "Opening branch must match the account branch",
          });
      }
    })
    .parse(raw);
  if(d.type!=="BANK"&&hasBankMetadata(d))throw new Error("BANK_METADATA_NOT_APPLICABLE");
  if(d.printUpiQr&&!d.upiId)throw new Error("BANK_UPI_REQUIRED");
  const openingAmount = new D(openingBalance);
  const hasOpening = !openingAmount.isZero();
  if (
    hasOpening &&
    !canUsePermission(a, "SALESPUNCH360_ACCOUNT", "ACCOUNT_OPENING_BALANCE")
  )
    throw new AuthorizationError();
  if (hasOpening) branchOk(a, (d.branchId ?? openingBranchId)!);
  if (!canUsePermission(a, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_ENTRY"))
    throw new AuthorizationError();
  const creationRequestHash = creationRequestKey
    ? createHash("sha256")
        .update(
          JSON.stringify({
            type: d.type,
            name: d.name,
            branchId: d.branchId ?? null,
            bankName: d.bankName ?? "",
            accountNumberMasked: d.accountNumberMasked ?? "",
            ifsc: d.ifsc ?? "",
            ...(hasBankMetadata(d)?{accountHolderName:d.accountHolderName??"",bankBranchName:d.bankBranchName??"",upiId:d.upiId??"",printBankDetails:d.printBankDetails,printUpiQr:d.printUpiQr}:{}),
            ...(hasOpening
              ? {
                  openingBalance: openingAmount.toFixed(2),
                  openingDate,
                  openingBranchId: d.branchId ?? openingBranchId,
                }
              : {}),
          }),
        )
        .digest("hex")
    : undefined;
  if (d.branchId) branchOk(a, d.branchId);
  return retrySerializable(
    () =>
      db.$transaction(
        async (tx) => {
          if (hasOpening)
            await tx.$queryRaw`SELECT 1 FROM "companies" WHERE "id"=${a.companyId}::uuid FOR UPDATE`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${a.companyId + ":money-ledger-code"}))`;
          if (creationRequestKey) {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${a.companyId + ":money-create:" + creationRequestKey}))`;
            const existing = await tx.moneyAccount.findFirst({
              where: { companyId: a.companyId, creationRequestKey },
            });
            if (existing) {
              if (existing.branchId) branchOk(a, existing.branchId);
              if (existing.creationRequestHash !== creationRequestHash)
                throw new Error("IDEMPOTENCY_CONFLICT");
              return existing;
            }
          }
          if (
            d.branchId &&
            !(await tx.branch.findFirst({
              where: { id: d.branchId, companyId: a.companyId, isActive: true },
            }))
          )
            throw new Error("INVALID_BRANCH");
          const code = await allocateMoneyLedgerCodeInTx(tx, a.companyId),
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
              data: {
                ...d,
                creationRequestKey,
                creationRequestHash,
                companyId: a.companyId,
                ledgerAccountId: ledger.id,
              },
            });
          if (hasOpening) {
            const journalBranch = (d.branchId ?? openingBranchId)!;
            const date = new Date(openingDate!);
            const fy = await context(tx, a, journalBranch, date);
            let equity = await tx.ledgerAccount.findFirst({
              where: {
                companyId: a.companyId,
                systemKey: "OPENING_BALANCE_EQUITY",
              },
            });
            if (!equity)
              equity = await tx.ledgerAccount.create({
                data: {
                  companyId: a.companyId,
                  code: "3300",
                  name: "Opening Balance Equity",
                  accountClass: "EQUITY",
                  normalBalance: "CREDIT",
                  systemKey: "OPENING_BALANCE_EQUITY",
                  isSystem: true,
                  allowPosting: true,
                },
              });
            if (
              equity.accountClass !== "EQUITY" ||
              equity.normalBalance !== "CREDIT" ||
              !equity.isActive ||
              !equity.allowPosting
            )
              throw new Error("INVALID_OPENING_BALANCE_EQUITY");
            const amount = openingAmount.abs().toFixed(2);
            await postJournalInTx(
              tx,
              a,
              {
                financialYearId: fy.id,
                branchId: journalBranch,
                entryDate: date,
                sourceType: "OPENING_BALANCE",
                sourceId: row.id,
                postingPurpose: "MONEY_ACCOUNT_OPENING",
                narration: "Opening balance",
                lines: [
                  {
                    ledgerAccountId: ledger.id,
                    debit: openingAmount.isPositive() ? amount : "0",
                    credit: openingAmount.isNegative() ? amount : "0",
                    description: "Opening balance",
                  },
                  {
                    ledgerAccountId: equity.id,
                    debit: openingAmount.isNegative() ? amount : "0",
                    credit: openingAmount.isPositive() ? amount : "0",
                    description: "Opening balance offset",
                  },
                ],
              },
              "OPENING_BALANCE_POSTED",
            );
          }
          await audit(tx, a, "MONEY_ACCOUNT_CREATED", "MONEY_ACCOUNT", row.id);
          return row;
        },
        {
          isolationLevel: hasOpening
            ? Prisma.TransactionIsolationLevel.Serializable
            : Prisma.TransactionIsolationLevel.ReadCommitted,
        },
      ),
    3,
    creationRequestKey ? ["companyId", "creationRequestKey"] : undefined,
  );
}
function moneyAccountAuditSnapshot(row: {
  name: string;
  bankName: string | null;
  accountNumberMasked: string | null;
  ifsc: string | null;
  accountHolderName:string|null;bankBranchName:string|null;upiId:string|null;printBankDetails:boolean;printUpiQr:boolean;
  isActive: boolean;
  ledgerAccountId: string;
  branchId: string | null;
}) {
  return {
    name: row.name,
    bankName: row.bankName,
    accountNumberMasked: row.accountNumberMasked,
    ifsc: row.ifsc,
    accountHolderName:row.accountHolderName,bankBranchName:row.bankBranchName,upiId:row.upiId,printBankDetails:row.printBankDetails,printUpiQr:row.printUpiQr,
    isActive: row.isActive,
    ledgerAccountId: row.ledgerAccountId,
    branchId: row.branchId,
  };
}
async function mutateMoneyAccountForActor(
  a: Actor,
  id: string,
  data: Prisma.MoneyAccountUpdateInput,
  eventType: string,
) {
  z.string().uuid().parse(id);
  if (!canUsePermission(a, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_ENTRY"))
    throw new AuthorizationError();
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${a.companyId + ":money-account:" + id}))`;
        const before = await tx.moneyAccount.findFirst({
          where: {
            id,
            companyId: a.companyId,
            ...manageableMoneyAccountScope(a),
          },
        });
        if (!before) throw new AuthorizationError();
        if(before.type!=="BANK"&&hasBankMetadata(data as Record<string,unknown>))throw new Error("BANK_METADATA_NOT_APPLICABLE");
        const after = await tx.moneyAccount.update({
          where: { id: before.id },
          data,
        });
        if(after.printUpiQr&&!after.upiId)throw new Error("BANK_UPI_REQUIRED");
        if (before.name !== after.name) {
          const changed = await tx.ledgerAccount.updateMany({
            where: { id: before.ledgerAccountId, companyId: a.companyId },
            data: { name: after.name },
          });
          if (changed.count !== 1)
            throw new Error("INVALID_MONEY_ACCOUNT_LEDGER");
        }
        if (
          JSON.stringify(moneyAccountAuditSnapshot(before)) !==
          JSON.stringify(moneyAccountAuditSnapshot(after))
        )
          await audit(tx, a, eventType, "MONEY_ACCOUNT", id, {
            before: moneyAccountAuditSnapshot(before),
            after: moneyAccountAuditSnapshot(after),
          });
        return after;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
export async function updateMoneyAccountForActor(
  a: Actor,
  id: string,
  raw: unknown,
) {
  const data = accountInput
    .partial()
    .omit({ type: true, branchId: true })
    .parse(raw);
  const patch:Prisma.MoneyAccountUpdateInput={...data};
  for(const key of ["accountHolderName","bankBranchName","upiId","ifsc"] as const){if(typeof (raw as Record<string,unknown>)[key]==="string"&&String((raw as Record<string,unknown>)[key]).trim()==="")patch[key]=null;}
  return mutateMoneyAccountForActor(a, id, patch, "MONEY_ACCOUNT_UPDATED");
}
export async function deactivateMoneyAccountForActor(a: Actor, id: string) {
  return mutateMoneyAccountForActor(
    a,
    id,
    { isActive: false },
    "MONEY_ACCOUNT_DEACTIVATED",
  );
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
        journalEntry: {
          status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
          ...branchScope(a),
        },
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
        ...EFFECTIVE_SETTLEMENT,
        companyId: a.companyId,
        type: { in: ["CUSTOMER_ADVANCE", "VENDOR_ADVANCE"] },
        ...branchScope(a),
      },
      orderBy: { transactionDate: "desc" },
      take: 20,
    }),
    owners: await db.ownerFinancialAccount.findMany({
      select: {
        id: true,
        companyId: true,
        userId: true,
        name: true,
        partyType: true,
        phone: true,
        email: true,
        address: true,
        isActive: true,
        capitalLedgerId: true,
        drawingsLedgerId: true,
        loanLedgerId: true,
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
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
const chequeInput = z
  .object({
    branchId: z.string().uuid(),
    moneyAccountId: z.string().uuid(),
    partyId: z.string().uuid(),
    sourceDocumentId: z.string().uuid().optional(),
    amount: money.refine(
      (value) => new D(value).gt(0),
      "Amount must be positive",
    ),
    requestKey: z.string().uuid(),
    chequeNumber: z.string().trim().min(1).max(80),
    chequeDate: z.coerce.date(),
    status: z.nativeEnum(ChequeStatus),
    reference: z.string().max(160).optional(),
  })
  .strict();
export async function createChequeForActor(a: Actor, raw: unknown) {
  if (!canUsePermission(a, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_ENTRY"))
    throw new AuthorizationError();
  const status = z
    .nativeEnum(ChequeStatus)
    .parse((raw as { status?: unknown }).status);
  if (!["ISSUED", "RECEIVED"].includes(status))
    throw new Error("INVALID_CHEQUE_INITIAL_STATUS");
  const d = chequeInput.parse(raw);
  const customer = d.status === "RECEIVED";
  const source = await createSettlementForActor(a, {
    idempotencyKey: d.requestKey,
    branchId: d.branchId,
    partyId: d.partyId,
    type: customer
      ? d.sourceDocumentId
        ? "CUSTOMER_RECEIPT"
        : "CUSTOMER_ADVANCE"
      : d.sourceDocumentId
        ? "VENDOR_PAYMENT"
        : "VENDOR_ADVANCE",
    moneyAccountId: d.moneyAccountId,
    paymentMode: "CHEQUE",
    amount: d.amount,
    chequeNumber: d.chequeNumber,
    chequeDate: d.chequeDate,
    transactionDate: d.chequeDate,
    reference: d.reference,
    allocations: d.sourceDocumentId
      ? [{ documentId: d.sourceDocumentId, amount: d.amount }]
      : [],
  });
  return db.cheque.findFirstOrThrow({
    where: { companyId: a.companyId, id: source.chequeId! },
  });
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
        // Legacy metadata transitions cannot post or undo a receipt without a normalized source and action identity.
        if (row.settlementId)
          throw new Error("CHEQUE_FINANCIAL_ACTION_REQUIRED");
        if (row.journalEntryId || ["DEPOSITED", "CLEARED"].includes(to))
          throw new Error("LEGACY_CHEQUE_SOURCE_REQUIRED");
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
  const series = await tx.numberingSeries.findFirst({
    where: { companyId: a.companyId, seriesKey: "OWNER_LEDGER" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, branchId: true },
  });
  const code = await allocateDocumentNumberInTx(tx, {
    companyId: a.companyId,
    ...(series
      ? { seriesId: series.id, branchId: series.branchId ?? undefined }
      : { branchId, seriesKey: "OWNER_LEDGER" }),
    defaults: { prefix: "OWN-", padding: 6 },
  });
  return tx.ledgerAccount.create({
    data: {
      companyId: a.companyId,
      code,
      name: `${Array.from(name).slice(0, 120).join("")} [${code}]`,
      accountClass,
      normalBalance,
      allowPosting: true,
    },
  });
}
const ownerIdentityInput = z
  .object({
    name: z.string().trim().min(1).max(160),
    partyType: z.enum(["OWNER", "PARTNER"]).default("OWNER"),
    userId: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.string().uuid().optional(),
    ),
    branchId: z.string().uuid(),
    phone: z.string().trim().max(40).optional(),
    email: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.string().trim().email().max(320).optional(),
    ),
    address: z.string().trim().max(2000).optional(),
    creationRequestKey: z.string().uuid(),
  })
  .strict();
export async function createOwnerFinancialAccountForActor(
  a: Actor,
  raw: unknown,
) {
  if (a.accountRole !== "ACCOUNT_ADMIN") throw new AuthorizationError();
  const d = ownerIdentityInput.parse(raw);
  branchOk(a, d.branchId);
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        d.name,
        d.partyType,
        d.userId ?? null,
        d.branchId,
        d.phone ?? "",
        d.email ?? "",
        d.address ?? "",
      ]),
    )
    .digest("hex");
  return retrySerializable(
    () =>
      db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT 1 FROM "companies" WHERE "id"=${a.companyId}::uuid FOR UPDATE`;
          const replay = await tx.ownerFinancialAccount.findFirst({
            where: {
              companyId: a.companyId,
              creationRequestKey: d.creationRequestKey,
            },
          });
          if (replay) {
            if (replay.creationInputHash !== hash)
              throw new Error("IDEMPOTENCY_CONFLICT");
            return replay;
          }
          if (
            !(await tx.branch.findFirst({
              where: { id: d.branchId, companyId: a.companyId, isActive: true },
            }))
          )
            throw new AuthorizationError();
          if (d.userId) {
            if (
              !(await tx.user.findFirst({
                where: { id: d.userId, companyId: a.companyId, isActive: true },
              }))
            )
              throw new Error("INVALID_OWNER");
            if (
              await tx.ownerFinancialAccount.findFirst({
                where: { companyId: a.companyId, userId: d.userId },
              })
            )
              throw new Error("OWNER_USER_ALREADY_LINKED");
          }
          const capital = await createLedger(
            tx,
            a,
            d.branchId,
            `${d.name} Capital`,
            "EQUITY",
            "CREDIT",
          );
          const drawings = await createLedger(
            tx,
            a,
            d.branchId,
            `${d.name} Drawings`,
            "EQUITY",
            "DEBIT",
          );
          const loan = await createLedger(
            tx,
            a,
            d.branchId,
            `${d.name} Loan`,
            "LIABILITY",
            "CREDIT",
          );
          const row = await tx.ownerFinancialAccount.create({
            data: {
              companyId: a.companyId,
              userId: d.userId,
              name: d.name,
              partyType: d.partyType,
              phone: d.phone,
              email: d.email,
              address: d.address,
              creationRequestKey: d.creationRequestKey,
              creationInputHash: hash,
              capitalLedgerId: capital.id,
              drawingsLedgerId: drawings.id,
              loanLedgerId: loan.id,
            },
          });
          await audit(tx, a, "OWNER_CREATED", "OWNER", row.id, {
            name: row.name,
            partyType: row.partyType,
            userId: row.userId,
            ledgers: {
              capital: capital.id,
              drawings: drawings.id,
              loan: loan.id,
            },
          });
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    3,
    ["companyId", "creationRequestKey"],
  );
}
export async function updateOwnerFinancialAccountForActor(
  a: Actor,
  id: string,
  raw: unknown,
) {
  if (a.accountRole !== "ACCOUNT_ADMIN") throw new AuthorizationError();
  z.string().uuid().parse(id);
  const d = z
    .object({
      name: z.string().trim().min(1).max(160),
      partyType: z.enum(["OWNER", "PARTNER"]),
      phone: z.string().trim().max(40),
      email: z.union([z.literal(""), z.string().trim().email().max(320)]),
      address: z.string().trim().max(2000),
      isActive: z.boolean(),
    })
    .strict()
    .parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "companies" WHERE "id"=${a.companyId}::uuid FOR UPDATE`;
    const before = await tx.ownerFinancialAccount.findFirst({
      where: { id, companyId: a.companyId },
    });
    if (!before) throw new AuthorizationError();
    const after = await tx.ownerFinancialAccount.update({
      where: { id },
      data: {
        ...d,
        email: d.email || null,
        phone: d.phone || null,
        address: d.address || null,
      },
    });
    await audit(tx, a, "OWNER_UPDATED", "OWNER", id, {
      before: {
        name: before.name,
        partyType: before.partyType,
        phone: before.phone,
        email: before.email,
        address: before.address,
        isActive: before.isActive,
      },
      after: d,
    });
    return after;
  });
}
export async function setupOwnerFinancialAccountForActor(
  a: Actor,
  userId: string,
  branchId: string,
) {
  if (a.accountRole !== "ACCOUNT_ADMIN") throw new AuthorizationError();
  z.string().uuid().parse(userId);
  z.string().uuid().parse(branchId);
  branchOk(a, branchId);
  if (
    !(await db.branch.findFirst({
      where: { id: branchId, companyId: a.companyId, isActive: true },
    }))
  )
    throw new AuthorizationError();
  const user = await db.user.findFirst({
    where: { id: userId, companyId: a.companyId, isActive: true },
  });
  if (!user) throw new Error("INVALID_OWNER");
  const existing = await db.ownerFinancialAccount.findFirst({
    where: { companyId: a.companyId, userId },
  });
  if (existing) return existing;
  return createOwnerFinancialAccountForActor(a, {
    userId,
    branchId,
    name: user.name,
    creationRequestKey: crypto.randomUUID(),
  });
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
  if (
    !canUsePermission(a, "SALESPUNCH360_ACCOUNT", "ACCOUNT_MONEY_ENTRY") ||
    (d.type === "OWNER_LOAN" &&
      !canUsePermission(a, "SALESPUNCH360_ACCOUNT", "ACCOUNT_LOAN_ADMIN"))
  )
    throw new AuthorizationError();
  branchOk(a, d.branchId);
  if (!new D(d.amount).gt(0)) throw new Error("INVALID_AMOUNT");
  return retrySerializable(
    () =>
      db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"owner:" + a.companyId + ":" + d.idempotencyKey}))`;
          // All journal posting/reversal paths share this company row lock.
          // Read Committed then reads funds after preceding writers have committed.
          await tx.$queryRaw`SELECT 1 FROM "companies" WHERE "id"=${a.companyId}::uuid FOR UPDATE`;
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
                  isActive: true,
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
          if (
            [
              "WITHDRAWAL",
              "CAPITAL_WITHDRAWAL",
              "PROFIT_DISTRIBUTION",
            ].includes(d.type)
          ) {
            await tx.$queryRaw`SELECT "id" FROM "money_accounts" WHERE "id"=${moneyAccount.id}::uuid AND "companyId"=${a.companyId}::uuid FOR UPDATE`;
            const funds = await tx.journalLine.aggregate({
              where: {
                companyId: a.companyId,
                ledgerAccountId: moneyAccount.ledgerAccountId,
                journalEntry: {
                  status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
                },
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
            ownerLedger = ["INVESTMENT", "CAPITAL_WITHDRAWAL"].includes(d.type)
              ? owner.capitalLedgerId
              : ["WITHDRAWAL", "PROFIT_DISTRIBUTION"].includes(d.type)
                ? owner.drawingsLedgerId
                : owner.loanLedgerId,
            incoming = ["INVESTMENT", "OWNER_LOAN"].includes(d.type),
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
                CAPITAL_WITHDRAWAL: "OWNER_CAPITAL_WITHDRAWAL_POSTED",
                PROFIT_DISTRIBUTION: "OWNER_PROFIT_DISTRIBUTION_POSTED",
              } as const
            )[d.type],
            "OWNER_TRANSACTION",
            row.id,
          );
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      ),
    3,
    ["companyId", "idempotencyKey"],
  );
}
export const loanInput = z.object({
  displayName: z.string().trim().max(240).transform(v=>v||undefined).optional(),
  loanAccountNumber: z.string().trim().max(160).transform(v=>v||undefined).optional(),
  description: z.string().trim().max(2000).transform(v=>v||undefined).optional(),
  durationMonths: z.preprocess(v=>v===""||v==null?undefined:v,z.coerce.number().int().min(1).max(1200).optional()),
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
  if(!canUsePermission(a,"SALESPUNCH360_ACCOUNT","ACCOUNT_LOAN_ADMIN"))throw new AuthorizationError();
  const d = loanInput.parse(raw);
  const fingerprint=loanCreationFingerprint(d);
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
            if(existing.creationRequestHash){if(existing.creationRequestHash!==fingerprint)throw new Error("IDEMPOTENCY_CONFLICT");return existing;}
            if (
              existing.branchId !== d.branchId ||
              existing.moneyAccountId !== d.moneyAccountId ||
              existing.lender !== d.lender ||
              existing.loanType !== d.loanType ||
              (existing.displayName??"") !== (d.displayName??"") ||
              (existing.loanAccountNumber??"") !== (d.loanAccountNumber??"") ||
              (existing.description??"") !== (d.description??"") ||
              (existing.durationMonths??null) !== (d.durationMonths??null) ||
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
                creationRequestHash:fingerprint,
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
export const paymentInput = z.object({
  description:z.string().trim().max(2000).transform(v=>v||undefined).optional(),
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
  if(!canUsePermission(a,"SALESPUNCH360_ACCOUNT","ACCOUNT_LOAN_ADMIN"))throw new AuthorizationError();
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
              !existing.charges.eq(d.charges) ||
              (existing.description??"") !== (d.description??"")
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
              narration:d.description,
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
    capabilities: {
      manageOwners: a.accountRole === "ACCOUNT_ADMIN",
      postMoneyEntries: canUsePermission(
        a,
        "SALESPUNCH360_ACCOUNT",
        "ACCOUNT_MONEY_ENTRY",
      ),
      manageLoans: canUsePermission(
        a,
        "SALESPUNCH360_ACCOUNT",
        "ACCOUNT_LOAN_ADMIN",
      ),
      postOwnerTransactions: canUsePermission(
        a,
        "SALESPUNCH360_ACCOUNT",
        "ACCOUNT_MONEY_ENTRY",
      ),
    },
    dashboard: await moneyDashboardForActor(a),
    cheques: await db.cheque.findMany({
      where: { companyId: a.companyId, ...branchScope(a) },
      orderBy: [{ chequeDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 200,
    }),
    owners: await db.ownerFinancialAccount.findMany({
      select: {
        id: true,
        companyId: true,
        userId: true,
        name: true,
        partyType: true,
        phone: true,
        email: true,
        address: true,
        isActive: true,
        capitalLedgerId: true,
        drawingsLedgerId: true,
        loanLedgerId: true,
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      where: { companyId: a.companyId },
    }),
    loans: await db.loan.findMany({
      where: { companyId: a.companyId, ...branchScope(a) },
      orderBy: { startDate: "desc" },
    }),
    users: await db.user.findMany({
      select: { id: true, name: true },
      where: {
        companyId: a.companyId,
        isActive: true,
        ...(a.accountRole !== "ACCOUNT_ADMIN" ? { id: { in: [] } } : {}),
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
export async function moneyDashboard(query: unknown = {}) {
  const scope = await moneyReadContext(
    await actor("ACCOUNT_MONEY_VIEW"),
    query,
  );
  return {
    ...(await moneyDashboardForActor(scope.actor)),
    branchContext: scope.context,
  };
}
export async function createMoneyTransfer(raw: unknown) {
  return createMoneyTransferForActor(
    await actor("ACCOUNT_MONEY_ENTRY", true),
    raw,
  );
}
export async function postOwnerTransaction(raw: unknown) {
  return postOwnerTransactionForActor(
    await actor("ACCOUNT_MONEY_ENTRY", true),
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
export async function listMoneyData(query: unknown = {}) {
  const scope = await moneyReadContext(
    await actor("ACCOUNT_MONEY_VIEW"),
    query,
  );
  return {
    ...(await listMoneyDataForActor(scope.actor)),
    branchContext: scope.context,
  };
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
