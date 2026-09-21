import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import {
  costCentreSchema,
  ledgerAccountSchema,
  periodLockSchema,
  postingSchema,
  reversalSchema,
} from "./validation";
import { allocateDocumentNumberInTx } from "@/lib/account/numbering";
const D = Prisma.Decimal;
async function actor(
  permission:
    | "ACCOUNT_LEDGER_VIEW"
    | "ACCOUNT_JOURNAL_POST"
    | "ACCOUNT_JOURNAL_REVERSE"
    | "ACCOUNT_OPENING_BALANCE"
    | "ACCOUNT_PERIOD_LOCK"
    | "ACCOUNT_CHART_ADMIN",
  mutation = true,
) {
  const a = mutation
    ? await requirePermissionForMutation(permission)
    : await requirePermission(permission);
  return { ...a, companyId: a.companyId! };
}
export async function accountingOverviewForActor(
  a: Awaited<ReturnType<typeof actor>>,
) {
  const branchWhere =
      a.branchAccessScope === "SELECTED_BRANCHES"
        ? { id: { in: a.branchIds ?? [] } }
        : {},
    data = await db.company.findUniqueOrThrow({
      where: { id: a.companyId },
      select: {
        ledgerAccounts: { orderBy: { code: "asc" } },
        costCentres: { orderBy: { code: "asc" } },
        journalEntries: {
          where: { branch: branchWhere },
          orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
          take: 100,
          include: { lines: true },
        },
        financialYears: {
          where: { isActive: true },
          orderBy: { startDate: "desc" },
        },
        branches: {
          where: { isActive: true, ...branchWhere },
          orderBy: { name: "asc" },
        },
        accountingPeriodLocks: true,
      },
    });
  return {
    ...data,
    capabilities: {
      canPost:
        a.accountRole === "ACCOUNT_ADMIN" || a.accountRole === "ACCOUNTANT",
      canManageChart: a.accountRole === "ACCOUNT_ADMIN",
      canManagePeriods: a.accountRole === "ACCOUNT_ADMIN",
      canPostOpening:
        a.accountRole === "ACCOUNT_ADMIN" || a.accountRole === "ACCOUNTANT",
    },
  };
}
export async function createLedgerAccountForActor(
  a: Awaited<ReturnType<typeof actor>>,
  raw: unknown,
) {
  const d = ledgerAccountSchema.parse(raw);
  if (
    d.parentId &&
    !(await db.ledgerAccount.findFirst({
      where: {
        id: d.parentId,
        companyId: a.companyId,
        isActive: true,
        allowPosting: false,
      },
    }))
  )
    throw new Error("INVALID_PARENT_ACCOUNT");
  return db.ledgerAccount.create({ data: { companyId: a.companyId, ...d } });
}
export async function createCostCentre(raw: unknown) {
  const a = await actor("ACCOUNT_CHART_ADMIN"),
    d = costCentreSchema.parse(raw);
  return db.costCentre.create({ data: { companyId: a.companyId, ...d } });
}
function assertBalanced(lines: { debit: string; credit: string }[]) {
  const debit = lines.reduce((n, l) => n.add(l.debit), new D(0)),
    credit = lines.reduce((n, l) => n.add(l.credit), new D(0));
  if (!debit.equals(credit) || debit.isZero())
    throw new Error("UNBALANCED_JOURNAL");
}
async function lockCompany(tx: Prisma.TransactionClient, companyId: string) {
  await tx.$queryRaw`SELECT 1 FROM "companies" WHERE "id"=${companyId}::uuid FOR UPDATE`;
}
async function validateContext(
  tx: Prisma.TransactionClient,
  a: { companyId: string; branchAccessScope?: string; branchIds?: string[] },
  d: { financialYearId: string; branchId: string; entryDate: Date },
) {
  if (
    a.branchAccessScope === "SELECTED_BRANCHES" &&
    !(a.branchIds ?? []).includes(d.branchId)
  )
    throw new Error("INVALID_BRANCH");
  const [fy, branch, lock] = await Promise.all([
    tx.financialYear.findFirst({
      where: {
        id: d.financialYearId,
        companyId: a.companyId,
        isActive: true,
        startDate: { lte: d.entryDate },
        endDate: { gte: d.entryDate },
      },
    }),
    tx.branch.findFirst({
      where: { id: d.branchId, companyId: a.companyId, isActive: true },
    }),
    tx.accountingPeriodLock.findFirst({
      where: { companyId: a.companyId, financialYearId: d.financialYearId },
    }),
  ]);
  if (!fy || fy.status === "CLOSED") throw new Error("INVALID_FINANCIAL_YEAR");
  if (!branch) throw new Error("INVALID_BRANCH");
  if (lock?.lockedThrough && d.entryDate <= lock.lockedThrough)
    throw new Error("PERIOD_LOCKED");
}
const number = (
  tx: Prisma.TransactionClient,
  companyId: string,
  branchId: string,
) =>
  allocateDocumentNumberInTx(tx, {
    companyId,
    branchId,
    seriesKey: "MANUAL_JOURNAL",
    defaults: { prefix: "JV-", padding: 6 },
  });
export async function postJournalInTx(
  tx: Prisma.TransactionClient,
  a: {
    id: string;
    companyId: string;
    branchAccessScope?: string;
    branchIds?: string[];
  },
  raw: unknown,
  event: "JOURNAL_POSTED" | "OPENING_BALANCE_POSTED" = "JOURNAL_POSTED",
) {
  const d = postingSchema.parse(raw);
  assertBalanced(d.lines);
  await lockCompany(tx, a.companyId);
  await validateContext(tx, a, d);
  const accountIds = [...new Set(d.lines.map((x) => x.ledgerAccountId))],
    costIds = [
      ...new Set(
        d.lines.flatMap((x) => (x.costCentreId ? [x.costCentreId] : [])),
      ),
    ];
  const [accounts, costs] = await Promise.all([
    tx.ledgerAccount.findMany({
      where: {
        companyId: a.companyId,
        id: { in: accountIds },
        isActive: true,
        allowPosting: true,
      },
    }),
    tx.costCentre.findMany({
      where: { companyId: a.companyId, id: { in: costIds }, isActive: true },
    }),
  ]);
  if (accounts.length !== accountIds.length)
    throw new Error("INVALID_LEDGER_ACCOUNT");
  if (costs.length !== costIds.length) throw new Error("INVALID_COST_CENTRE");
  const journalNumber = await number(tx, a.companyId, d.branchId);
  const draft = await tx.journalEntry.create({
    data: {
      companyId: a.companyId,
      financialYearId: d.financialYearId,
      branchId: d.branchId,
      journalNumber,
      entryDate: d.entryDate,
      status: "DRAFT",
      reference: d.reference,
      narration: d.narration,
      sourceType: d.sourceType,
      sourceId: d.sourceId,
      postingPurpose: d.postingPurpose,
      createdById: a.id,
      lines: {
        create: d.lines.map((l, i) => ({
          companyId: a.companyId,
          lineNumber: i + 1,
          ledgerAccountId: l.ledgerAccountId,
          costCentreId: l.costCentreId,
          debit: new D(l.debit),
          credit: new D(l.credit),
          description: l.description,
        })),
      },
    },
  });
  const j = await tx.journalEntry.update({
    where: { id: draft.id },
    data: { status: "POSTED", postedById: a.id, postedAt: new Date() },
  });
  await tx.accountingAuditEvent.create({
    data: {
      companyId: a.companyId,
      actorUserId: a.id,
      eventType: event,
      entityType: "JOURNAL_ENTRY",
      entityId: j.id,
    },
  });
  return j;
}
export async function postJournalForActor(
  a: Awaited<ReturnType<typeof actor>>,
  raw: unknown,
) {
  return db.$transaction((tx) => postJournalInTx(tx, a, raw), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}
export async function postOpeningBalances(raw: unknown) {
  const a = await actor("ACCOUNT_OPENING_BALANCE");
  return db.$transaction(
    async (tx) => {
      const input = postingSchema.parse(raw);
      if (input.sourceType !== "OPENING_BALANCE")
        throw new Error("INVALID_SOURCE");
      return postJournalInTx(tx, a, input, "OPENING_BALANCE_POSTED");
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function setPeriodLockForActor(
  a: Awaited<ReturnType<typeof actor>>,
  raw: unknown,
) {
  const d = periodLockSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      await lockCompany(tx, a.companyId);
      const [fy, current] = await Promise.all([
        tx.financialYear.findFirst({
          where: {
            id: d.financialYearId,
            companyId: a.companyId,
            isActive: true,
          },
        }),
        tx.accountingPeriodLock.findFirst({
          where: { companyId: a.companyId, financialYearId: d.financialYearId },
        }),
      ]);
      if (
        !fy ||
        (d.lockedThrough &&
          (d.lockedThrough < fy.startDate || d.lockedThrough > fy.endDate))
      )
        throw new Error("INVALID_LOCK_DATE");
      if (
        !d.lockedThrough ||
        (current?.lockedThrough && d.lockedThrough < current.lockedThrough)
      )
        throw new Error("PERIOD_UNLOCK_NOT_SUPPORTED");
      const row = await tx.accountingPeriodLock.upsert({
        where: {
          companyId_financialYearId: {
            companyId: a.companyId,
            financialYearId: d.financialYearId,
          },
        },
        create: {
          companyId: a.companyId,
          financialYearId: d.financialYearId,
          lockedThrough: d.lockedThrough,
          updatedById: a.id,
        },
        update: { lockedThrough: d.lockedThrough, updatedById: a.id },
      });
      await tx.accountingAuditEvent.create({
        data: {
          companyId: a.companyId,
          actorUserId: a.id,
          eventType: "PERIOD_LOCKED",
          entityType: "FINANCIAL_YEAR",
          entityId: d.financialYearId,
          reason: d.reason,
        },
      });
      return row;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function reverseJournalForActor(
  a: {
    id: string;
    companyId: string;
    branchAccessScope?: string;
    branchIds?: string[];
  },
  raw: unknown,
) {
  const d = reversalSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      await lockCompany(tx, a.companyId);
      const original = await tx.journalEntry.findFirst({
        where: {
          id: d.journalEntryId,
          companyId: a.companyId,
          status: "POSTED",
          reversedBy: null,
        },
        include: { lines: true },
      });
      if (!original) throw new Error("JOURNAL_NOT_REVERSIBLE");
      const reversalYear = await tx.financialYear.findFirst({
        where: {
          companyId: a.companyId,
          isActive: true,
          startDate: { lte: d.entryDate },
          endDate: { gte: d.entryDate },
        },
      });
      if (!reversalYear) throw new Error("INVALID_FINANCIAL_YEAR");
      await validateContext(tx, a, {
        financialYearId: reversalYear.id,
        branchId: original.branchId,
        entryDate: d.entryDate,
      });
      const journalNumber = await number(tx, a.companyId, original.branchId);
      const draft = await tx.journalEntry.create({
        data: {
          companyId: a.companyId,
          financialYearId: reversalYear.id,
          branchId: original.branchId,
          journalNumber,
          entryDate: d.entryDate,
          status: "DRAFT",
          sourceType: "REVERSAL",
          sourceId: original.id,
          postingPurpose: "REVERSAL",
          reversalOfId: original.id,
          reversalReason: d.reason,
          narration: `Reversal: ${d.reason}`,
          createdById: a.id,
          lines: {
            create: original.lines.map((l) => ({
              companyId: a.companyId,
              lineNumber: l.lineNumber,
              ledgerAccountId: l.ledgerAccountId,
              costCentreId: l.costCentreId,
              debit: l.credit,
              credit: l.debit,
              description: l.description,
            })),
          },
        },
      });
      const reversal = await tx.journalEntry.update({
        where: { id: draft.id },
        data: { status: "POSTED", postedById: a.id, postedAt: new Date() },
      });
      await tx.journalEntry.update({
        where: { id: original.id },
        data: { status: "REVERSED" },
      });
      await tx.accountingAuditEvent.create({
        data: {
          companyId: a.companyId,
          actorUserId: a.id,
          eventType: "JOURNAL_REVERSED",
          entityType: "JOURNAL_ENTRY",
          entityId: original.id,
          reason: d.reason,
          metadata: { reversalId: reversal.id },
        },
      });
      return reversal;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function reverseJournal(raw: unknown) {
  return reverseJournalForActor(await actor("ACCOUNT_JOURNAL_REVERSE"), raw);
}

export async function accountingOverview() {
  return accountingOverviewForActor(await actor("ACCOUNT_LEDGER_VIEW", false));
}
export async function createLedgerAccount(raw: unknown) {
  return createLedgerAccountForActor(await actor("ACCOUNT_CHART_ADMIN"), raw);
}
export async function postJournal(raw: unknown) {
  return postJournalForActor(await actor("ACCOUNT_JOURNAL_POST"), raw);
}
export async function setPeriodLock(raw: unknown) {
  return setPeriodLockForActor(await actor("ACCOUNT_PERIOD_LOCK"), raw);
}
