import { moneyReadContext } from "./money-context";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
const url = process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error("Isolated local *_ci database required");
const client = new PrismaClient({
  datasources: {
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/checkpoint_ci" },
  },
});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }),
}));
import {
  createMoneyTransferForActor,
  moneyDashboardForActor,
  createMoneyAccountForActor,
  updateMoneyAccountForActor,
  deactivateMoneyAccountForActor,
} from "./money";
import type { ProjectActor } from "./projects";
const companyId = randomUUID(),
  otherCompany = randomUUID(),
  userId = randomUUID();
const actor = {
  id: userId,
  name: "Unit administrator",
  email: `${userId}@example.test`,
  companyId,
  role: "ACCOUNT_USER",
  accountRole: "ACCOUNT_ADMIN",
  isActive: true,
  accountAccessActive: true,
  salesAccessActive: false,
  salesRole: null,
  managerType: null,
  branchAccessScope: "ALL_BRANCHES",
  branchIds: [],
} as ProjectActor;
let accountId: string, ledgerId: string;
const branchId = randomUUID();
describe.skipIf(!url)(
  "A064 audited money-account edits on isolated PostgreSQL",
  () => {
    beforeAll(async () => {
      await client.company.create({
        data: {
          id: companyId,
          name: "Money edit fixture",
          slug: `money-edit-${companyId}`,
          productEdition: "SALESPUNCH360_ACCOUNT",
        },
      });
      await client.user.create({
        data: {
          id: userId,
          companyId,
          name: "Admin",
          email: actor.email,
          passwordHash: "isolated-fixture",
          role: "ACCOUNT_USER",
          accountRole: "ACCOUNT_ADMIN",
          accountAccessActive: true,
        },
      });
      await client.branch.create({
        data: { id: branchId, companyId, name: "Money branch", code: "MONEY" },
      });
      await client.ledgerAccount.create({
        data: {
          companyId,
          code: "MA-000123",
          name: "Legacy retained money code",
          accountClass: "ASSET",
          normalBalance: "DEBIT",
        },
      });
      const ledger = await client.ledgerAccount.create({
        data: {
          companyId,
          code: "EDIT-BANK",
          name: "Original bank",
          accountClass: "ASSET",
          normalBalance: "DEBIT",
        },
      });
      ledgerId = ledger.id;
      accountId = (
        await client.moneyAccount.create({
          data: {
            companyId,
            branchId,
            type: "BANK",
            name: "Original bank",
            ledgerAccountId: ledgerId,
            bankName: "Bank",
            accountNumberMasked: "****1234",
          },
        })
      ).id;
    });
    afterAll(async () => {
      await client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
        await tx.accountOperationalAudit.deleteMany({ where: { companyId } });
        await tx.moneyTransfer.deleteMany({ where: { companyId } });
        await tx.journalLine.deleteMany({ where: { companyId } });
        await tx.journalEntry.deleteMany({ where: { companyId } });
        await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
        await tx.financialYear.deleteMany({ where: { companyId } });
        await tx.moneyAccount.deleteMany({ where: { companyId } });
        await tx.ledgerAccount.deleteMany({ where: { companyId } });
        await tx.user.deleteMany({ where: { companyId } });
        await tx.numberingSeries.deleteMany({ where: { companyId } });
        await tx.branch.deleteMany({ where: { companyId } });
        await tx.company.deleteMany({ where: { id: companyId } });
      });
      await client.$disconnect();
    });
    it("replays concurrent creation without a second account, ledger or audit", async () => {
      const input = {
        type: "BANK",
        name: "Retry-safe bank",
        branchId,
        creationRequestKey: randomUUID(),
      };
      const [first, second] = await Promise.all([
        createMoneyAccountForActor(actor, input),
        createMoneyAccountForActor(actor, input),
      ]);
      expect(second.id).toBe(first.id);
      const createdLedger = await client.ledgerAccount.findUniqueOrThrow({
        where: { id: first.ledgerAccountId },
      });
      expect(BigInt(createdLedger.code.slice(3))).toBeGreaterThan(BigInt(123));
      expect(
        await client.numberingSeries.count({
          where: {
            companyId,
            branchId: null,
            seriesKey: "MONEY_LEDGER_GLOBAL",
          },
        }),
      ).toBe(1);
      expect(
        await client.moneyAccount.count({
          where: { companyId, creationRequestKey: input.creationRequestKey },
        }),
      ).toBe(1);
      expect(
        await client.ledgerAccount.count({
          where: { companyId, name: input.name },
        }),
      ).toBe(1);
      expect(
        await client.accountOperationalAudit.count({
          where: {
            companyId,
            entityId: first.id,
            eventType: "MONEY_ACCOUNT_CREATED",
          },
        }),
      ).toBe(1);
      await expect(
        createMoneyAccountForActor(actor, { ...input, name: "Changed intent" }),
      ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
      await expect(
        createMoneyAccountForActor(
          { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
          input,
        ),
      ).rejects.toThrow();
      expect(
        (
          await client.moneyAccount.findUniqueOrThrow({
            where: { id: first.id },
          })
        ).name,
      ).toBe(input.name);
    });
    it("retains legacy account rows without inventing creation identities", async () => {
      expect(
        await client.moneyAccount.findUniqueOrThrow({
          where: { id: accountId },
        }),
      ).toMatchObject({ creationRequestKey: null, creationRequestHash: null });
    });
    it("renames the linked ledger atomically and records before/after without posting", async () => {
      await updateMoneyAccountForActor(actor, accountId, {
        name: "Renamed bank",
        bankName: "Updated bank",
      });
      expect(
        (
          await client.ledgerAccount.findUniqueOrThrow({
            where: { id: ledgerId },
          })
        ).name,
      ).toBe("Renamed bank");
      const audit = await client.accountOperationalAudit.findFirstOrThrow({
        where: { companyId, eventType: "MONEY_ACCOUNT_UPDATED" },
      });
      expect(audit.metadata).toMatchObject({
        before: { name: "Original bank", isActive: true },
        after: { name: "Renamed bank", isActive: true },
      });
      expect(await client.journalEntry.count({ where: { companyId } })).toBe(0);
    });
    it("rolls back account and ledger when the audit write fails", async () => {
      await expect(
        updateMoneyAccountForActor({ ...actor, id: randomUUID() }, accountId, {
          name: "Rolled back bank",
        }),
      ).rejects.toThrow();
      expect(
        (
          await client.moneyAccount.findUniqueOrThrow({
            where: { id: accountId },
          })
        ).name,
      ).toBe("Renamed bank");
      expect(
        (
          await client.ledgerAccount.findUniqueOrThrow({
            where: { id: ledgerId },
          })
        ).name,
      ).toBe("Renamed bank");
    });
    it("rejects foreign-company, excluded-branch and non-entry-role direct mutations", async () => {
      for (const denied of [
        { ...actor, companyId: otherCompany },
        {
          ...actor,
          branchAccessScope: "SELECTED_BRANCHES" as const,
          branchIds: [],
        },
        { ...actor, accountRole: "PROJECT_MANAGER" as const },
      ]) {
        await expect(
          updateMoneyAccountForActor(denied, accountId, { name: "Denied" }),
        ).rejects.toThrow();
        await expect(
          deactivateMoneyAccountForActor(denied, accountId),
        ).rejects.toThrow();
      }
      expect(
        (
          await client.moneyAccount.findUniqueOrThrow({
            where: { id: accountId },
          })
        ).isActive,
      ).toBe(true);
    });
    it("audits deactivation once on repeat, preserving ledger posting identity", async () => {
      await deactivateMoneyAccountForActor(actor, accountId);
      await deactivateMoneyAccountForActor(actor, accountId);
      expect(
        await client.accountOperationalAudit.count({
          where: { companyId, eventType: "MONEY_ACCOUNT_DEACTIVATED" },
        }),
      ).toBe(1);
      expect(
        (
          await client.moneyAccount.findUniqueOrThrow({
            where: { id: accountId },
          })
        ).isActive,
      ).toBe(false);
      expect(
        await client.ledgerAccount.findUniqueOrThrow({
          where: { id: ledgerId },
        }),
      ).toMatchObject({
        code: "EDIT-BANK",
        name: "Renamed bank",
        isActive: true,
        allowPosting: true,
      });
    });
    it("posts opening equity atomically, replays safely, and allows an immutable manual clearing journal", async () => {
      const { postJournalForActor } = await import("@/lib/accounting/service");
      const fy = await client.financialYear.create({
        data: {
          companyId,
          name: "Opening year",
          startDate: new Date("2025-01-01"),
          endDate: new Date("2025-12-31"),
        },
      });
      const input = {
        type: "CASH",
        name: "Opening cash",
        branchId,
        creationRequestKey: randomUUID(),
        openingBalance: "5000.00",
        openingDate: "2025-10-13",
      };
      const created = await Promise.all([
        createMoneyAccountForActor(actor, input),
        createMoneyAccountForActor(actor, input),
      ]);
      expect(created[0].id).toBe(created[1].id);
      const account = created[0];
      expect((await createMoneyAccountForActor(actor, input)).id).toBe(
        account.id,
      );
      await expect(
        createMoneyAccountForActor(actor, { ...input, openingBalance: "5001" }),
      ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
      const opening = await client.journalEntry.findFirstOrThrow({
        where: { companyId, sourceId: account.id },
        include: { lines: true },
      });
      const equity = await client.ledgerAccount.findFirstOrThrow({
        where: { companyId, systemKey: "OPENING_BALANCE_EQUITY" },
      });
      expect(equity.accountClass).toBe("EQUITY");
      expect(equity.allowPosting).toBe(true);
      expect(
        opening.lines
          .find((x) => x.ledgerAccountId === account.ledgerAccountId)
          ?.debit.toFixed(2),
      ).toBe("5000.00");
      expect(
        opening.lines
          .find((x) => x.ledgerAccountId === equity.id)
          ?.credit.toFixed(2),
      ).toBe("5000.00");
      expect(
        await client.journalEntry.count({
          where: { companyId, sourceId: account.id },
        }),
      ).toBe(1);
      await expect(
        createMoneyAccountForActor(
          { ...actor, accountRole: "PROJECT_MANAGER" },
          { ...input, creationRequestKey: randomUUID() },
        ),
      ).rejects.toThrow();
      await expect(
        createMoneyAccountForActor(
          { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
          { ...input, creationRequestKey: randomUUID() },
        ),
      ).rejects.toThrow();
      await expect(
        createMoneyAccountForActor(actor, {
          ...input,
          creationRequestKey: randomUUID(),
          openingDate: "2025-02-30",
        }),
      ).rejects.toThrow();
      const lock = await client.accountingPeriodLock.create({
        data: {
          companyId,
          financialYearId: fy.id,
          lockedThrough: new Date("2025-10-13"),
          updatedById: userId,
        },
      });
      try {
        await expect(
          createMoneyAccountForActor(actor, {
            ...input,
            name: "Locked opening cash",
            creationRequestKey: randomUUID(),
          }),
        ).rejects.toThrow("PERIOD_LOCKED");
        expect(
          await client.moneyAccount.count({
            where: { companyId, name: "Locked opening cash" },
          }),
        ).toBe(0);
        expect(
          await client.ledgerAccount.count({
            where: { companyId, name: "Locked opening cash" },
          }),
        ).toBe(0);
      } finally {
        await client.accountingPeriodLock.delete({ where: { id: lock.id } });
      }
      const overdraftInput = {
        ...input,
        type: "BANK",
        name: "Opening overdraft",
        creationRequestKey: randomUUID(),
        openingBalance: "-100.50",
      };
      const overdraft = await createMoneyAccountForActor(actor, overdraftInput);
      const negative = await client.journalEntry.findFirstOrThrow({
        where: { companyId, sourceId: overdraft.id },
        include: { lines: true },
      });
      expect(
        negative.lines
          .find((x) => x.ledgerAccountId === overdraft.ledgerAccountId)
          ?.credit.toFixed(2),
      ).toBe("100.50");
      expect(
        negative.lines
          .find((x) => x.ledgerAccountId === equity.id)
          ?.debit.toFixed(2),
      ).toBe("100.50");
      const retained = await client.ledgerAccount.create({
        data: {
          companyId,
          code: "3200",
          name: "Retained Earnings",
          accountClass: "EQUITY",
          normalBalance: "CREDIT",
          systemKey: "RETAINED_EARNINGS",
        },
      });
      await postJournalForActor(actor, {
        financialYearId: fy.id,
        branchId,
        entryDate: "2025-10-14",
        sourceType: "MANUAL_JOURNAL",
        sourceId: randomUUID(),
        lines: [
          { ledgerAccountId: equity.id, debit: "4899.50", credit: "0" },
          { ledgerAccountId: retained.id, debit: "0", credit: "4899.50" },
        ],
      });
      const total = await client.journalLine.aggregate({
        where: { companyId, ledgerAccountId: equity.id },
        _sum: { debit: true, credit: true },
      });
      expect(total._sum.debit?.equals(total._sum.credit!)).toBe(true);
      expect(
        (
          await client.journalEntry.findUniqueOrThrow({
            where: { id: opening.id },
          })
        ).status,
      ).toBe("POSTED");
      await expect(
        createMoneyAccountForActor(actor, {
          ...input,
          name: "Invalid date cash",
          creationRequestKey: randomUUID(),
          openingDate: "2024-01-01",
        }),
      ).rejects.toThrow("INVALID_FINANCIAL_YEAR");
      expect(
        await client.moneyAccount.count({
          where: { companyId, name: "Invalid date cash" },
        }),
      ).toBe(0);
      expect(
        await client.ledgerAccount.count({
          where: { companyId, name: "Invalid date cash" },
        }),
      ).toBe(0);
    });
    it("reads exact opening and running balances with date filters and branch isolation", async () => {
      const { moneyAccountHistoryForActor } =
        await import("./money-account-history");
      const account = await client.moneyAccount.findFirstOrThrow({
        where: { companyId, name: "Opening cash" },
      });
      const all = await moneyAccountHistoryForActor(actor, account.id, {
        branchId,
      });
      expect(all.opening).toBe("0.00");
      expect(all.closing).toBe("5000.00");
      expect(all.rows[0].balance).toBe("5000.00");
      expect(all.total).toBe(1);
      const after = await moneyAccountHistoryForActor(actor, account.id, {
        branchId,
        from: "2025-10-14",
      });
      expect(after.opening).toBe("5000.00");
      expect(after.closing).toBe("5000.00");
      expect(after.rows).toEqual([]);
      const before = await moneyAccountHistoryForActor(actor, account.id, {
        branchId,
        to: "2025-10-12",
      });
      expect(before.closing).toBe("0.00");
      await client.moneyAccount.update({
        where: { id: account.id },
        data: { isActive: false },
      });
      expect(
        (await moneyAccountHistoryForActor(actor, account.id, { branchId }))
          .closing,
      ).toBe("5000.00");
      await expect(
        moneyAccountHistoryForActor(actor, account.id, {
          branchId,
          from: "2025-02-30",
        }),
      ).rejects.toThrow();
      await expect(
        moneyAccountHistoryForActor(
          { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
          account.id,
          { branchId },
        ),
      ).rejects.toThrow();
      await expect(
        moneyAccountHistoryForActor(actor, randomUUID(), { branchId }),
      ).rejects.toThrow();
    });
    it("scopes shared-account balances to an authorized selected branch or Admin consolidation", async () => {
      const secondBranch = randomUUID();
      await client.branch.create({
        data: {
          id: secondBranch,
          companyId,
          name: "Second money branch",
          code: "MONEY2",
        },
      });
      await client.financialYear.create({
        data: {
          companyId,
          name: "Money context year",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
        },
      });
      const shared = await createMoneyAccountForActor(actor, {
        type: "BANK",
        name: "Context shared bank",
        creationRequestKey: randomUUID(),
      });
      const cash1 = await createMoneyAccountForActor(actor, {
        type: "CASH",
        name: "Context cash one",
        branchId,
        creationRequestKey: randomUUID(),
      });
      const cash2 = await createMoneyAccountForActor(actor, {
        type: "CASH",
        name: "Context cash two",
        branchId: secondBranch,
        creationRequestKey: randomUUID(),
      });
      await createMoneyTransferForActor(actor, {
        branchId,
        sourceAccountId: shared.id,
        destinationAccountId: cash1.id,
        amount: "10",
        transferDate: "2026-10-13",
        idempotencyKey: randomUUID(),
      });
      await createMoneyTransferForActor(actor, {
        branchId: secondBranch,
        sourceAccountId: shared.id,
        destinationAccountId: cash2.id,
        amount: "20",
        transferDate: "2026-10-13",
        idempotencyKey: randomUUID(),
      });
      const { moneyAccountHistoryForActor } =
        await import("./money-account-history");
      expect(
        (await moneyAccountHistoryForActor(actor, shared.id, { branchId }))
          .closing,
      ).toBe("-10.00");
      expect(
        (
          await moneyAccountHistoryForActor(actor, shared.id, {
            branchId: secondBranch,
          })
        ).closing,
      ).toBe("-20.00");
      const history = await moneyAccountHistoryForActor(actor, shared.id, {
        scope: "all",
        limit: 1,
      });
      expect(history.total).toBe(2);
      expect(history.closing).toBe("-30.00");
      expect(history.rows[0].balance).toBe("-30.00");
      const older = await moneyAccountHistoryForActor(actor, shared.id, {
        scope: "all",
        offset: 1,
        limit: 1,
      });
      expect(older.rows[0].balance).toBe("-10.00");
      expect(
        (await moneyAccountHistoryForActor(actor, cash1.id, { branchId }))
          .closing,
      ).toBe("10.00");
      await expect(
        moneyAccountHistoryForActor(actor, cash1.id, {
          branchId: secondBranch,
        }),
      ).rejects.toThrow();
      const branchOne = await moneyReadContext(actor, { branchId }),
        branchTwo = await moneyReadContext(actor, { branchId: secondBranch }),
        all = await moneyReadContext(actor, { scope: "all" });
      const first = await moneyDashboardForActor(branchOne.actor),
        second = await moneyDashboardForActor(branchTwo.actor),
        combined = await moneyDashboardForActor(all.actor);
      expect(
        first.accounts.find((row) => row.id === shared.id)?.balance.toFixed(2),
      ).toBe("-10.00");
      expect(
        second.accounts.find((row) => row.id === shared.id)?.balance.toFixed(2),
      ).toBe("-20.00");
      expect(
        combined.accounts
          .find((row) => row.id === shared.id)
          ?.balance.toFixed(2),
      ).toBe("-30.00");
      expect(first.accounts.some((row) => row.id === cash2.id)).toBe(false);
      expect(second.accounts.some((row) => row.id === cash1.id)).toBe(false);
      const restricted = {
        ...actor,
        branchAccessScope: "SELECTED_BRANCHES" as const,
        branchIds: [branchId],
      };
      await expect(
        moneyReadContext(restricted, { branchId: secondBranch }),
      ).rejects.toThrow();
      await expect(
        moneyReadContext(restricted, { scope: "all" }),
      ).rejects.toThrow();
      await expect(
        moneyReadContext(
          { ...actor, accountRole: "ACCOUNTANT" },
          { scope: "all" },
        ),
      ).rejects.toThrow();
      await expect(
        moneyReadContext({ ...actor, companyId: otherCompany }, { branchId }),
      ).rejects.toThrow();
      await expect(
        moneyReadContext(actor, { branchId, scope: "all" }),
      ).rejects.toThrow();
    });
  },
);
