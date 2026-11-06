import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ProjectActor } from "./projects";
const url = process.env.RESTORE_TEST_DATABASE_URL;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error("Isolated local *_ci database required");
const client = new PrismaClient({
  datasources: {
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/close_ci" },
  },
});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }),
}));
import { DEFAULT_LEDGER_ACCOUNTS } from "@/lib/accounting/default-accounts";
import { postJournalForActor } from "@/lib/accounting/service";
import {
  previewFinancialYearCloseForActor,
  closeFinancialYearForActor,
} from "./utilities";
const companyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  yearId = randomUUID();
const actor = {
  id: userId,
  name: "Fixture",
  email: `${userId}@example.test`,
  companyId,
  role: "ACCOUNT_USER",
  isActive: true,
  accountRole: "ACCOUNT_ADMIN",
  accountAccessActive: true,
  salesAccessActive: false,
  salesRole: null,
  managerType: null,
  branchAccessScope: "ALL_BRANCHES",
  branchIds: [],
} as ProjectActor;
describe.skipIf(!url)("close-books review and posting serialization", () => {
  beforeAll(async () => {
    await client.company.create({
      data: {
        id: companyId,
        name: "Close fixture",
        slug: `close-${companyId}`,
        productEdition: "SALESPUNCH360_ACCOUNT",
      },
    });
    await client.user.create({
      data: {
        id: userId,
        companyId,
        name: actor.name,
        email: actor.email,
        passwordHash: "fixture-only",
        role: "ACCOUNT_USER",
        accountRole: "ACCOUNT_ADMIN",
        accountAccessActive: true,
        branchAccessScope: "ALL_BRANCHES",
      },
    });
    await client.branch.create({
      data: { id: branchId, companyId, name: "Main", code: "MAIN" },
    });
    await client.financialYear.create({
      data: {
        id: yearId,
        companyId,
        name: "FY",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
      },
    });
    for (const row of DEFAULT_LEDGER_ACCOUNTS)
      await client.ledgerAccount.create({
        data: {
          companyId,
          code: row.code,
          name: row.name,
          accountClass: row.accountClass,
          normalBalance: row.normalBalance,
          systemKey: row.systemKey,
          isSystem: row.isSystem,
        },
      });
  });
  afterAll(async () => {
    await client.$disconnect();
  });
  it("review is read-only; branch-scoped administrators and missing reasons cannot close", async () => {
    const review = await previewFinancialYearCloseForActor(actor, yearId);
    expect(review.canClose).toBe(true);
    expect(review.earlyClose).toBe(true);
    expect(
      await client.accountingPeriodLock.count({ where: { companyId } }),
    ).toBe(0);
    await expect(
      closeFinancialYearForActor(actor, { financialYearId: yearId }),
    ).rejects.toThrow("EARLY_CLOSE_REASON_REQUIRED");
    await client.user.update({
      where: { id: userId },
      data: { branchAccessScope: "SELECTED_BRANCHES" },
    });
    await expect(
      previewFinancialYearCloseForActor(actor, yearId),
    ).rejects.toThrow("Not authorized");
    await expect(
      closeFinancialYearForActor(actor, {
        financialYearId: yearId,
        earlyCloseReason: "Test early close",
      }),
    ).rejects.toThrow("Not authorized");
    await client.user.update({
      where: { id: userId },
      data: { branchAccessScope: "ALL_BRANCHES" },
    });
    expect(
      (await client.financialYear.findUniqueOrThrow({ where: { id: yearId } }))
        .status,
    ).toBe("OPEN");
  });
  it("serializes posting and close, preserves history and makes repeated close idempotent", async () => {
    const ledgers = await client.ledgerAccount.findMany({
      where: { companyId, systemKey: { in: ["CASH", "OWNER_CAPITAL"] } },
    });
    const posting = {
      financialYearId: yearId,
      branchId,
      entryDate: new Date("2026-11-05"),
      sourceType: "MANUAL_JOURNAL",
      sourceId: randomUUID(),
      postingPurpose: "PRIMARY",
      lines: [
        { ledgerAccountId: ledgers[0].id, debit: "20", credit: "0" },
        { ledgerAccountId: ledgers[1].id, debit: "0", credit: "20" },
      ],
    };
    const results = await Promise.allSettled([
      postJournalForActor(actor, posting),
      closeFinancialYearForActor(actor, {
        financialYearId: yearId,
        earlyCloseReason: "Reviewed controlled fixture",
      }),
    ]);
    expect(results[1].status).toBe("fulfilled");
    const before = await client.journalEntry.count({ where: { companyId } });
    await expect(
      postJournalForActor(actor, { ...posting, sourceId: randomUUID() }),
    ).rejects.toThrow();
    expect(await client.journalEntry.count({ where: { companyId } })).toBe(
      before,
    );
    await closeFinancialYearForActor(actor, {
      financialYearId: yearId,
      earlyCloseReason: "Retry",
    });
    expect(
      await client.accountingAuditEvent.count({
        where: { companyId, eventType: "FINANCIAL_YEAR_CLOSED" },
      }),
    ).toBe(1);
    expect(
      (
        await client.accountingPeriodLock.findFirstOrThrow({
          where: { companyId },
        })
      )
        .lockedThrough!.toISOString()
        .slice(0, 10),
    ).toBe("2027-03-31");
  });
});
