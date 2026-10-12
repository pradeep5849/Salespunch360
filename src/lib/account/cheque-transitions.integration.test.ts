import { randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { PrismaClient, Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const url = process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if (
  url &&
  (!["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error("Isolated local *_ci database required");
const client = new PrismaClient({
  datasources: {
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/checkpoint_ci" },
  },
});
let failAudit: string | null = null;
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === "$transaction")
          return async (
            fn: (tx: Prisma.TransactionClient) => unknown,
            options: object,
          ) =>
            client.$transaction(
              async (tx) =>
                fn(
                  new Proxy(tx, {
                    get: (target, name) => {
                      if (name === "accountOperationalAudit")
                        return new Proxy(target.accountOperationalAudit, {
                          get: (delegate, action) => {
                            if (action === "create")
                              return async (
                                args: Parameters<typeof delegate.create>[0],
                              ) => {
                                if (
                                  failAudit &&
                                  args.data.eventType === failAudit
                                )
                                  throw new Error(
                                    "injected cheque audit failure",
                                  );
                                return delegate.create(args);
                              };
                            return delegate[action as keyof typeof delegate];
                          },
                        });
                      return target[name as keyof typeof target];
                    },
                  }),
                ),
              options,
            );
        const value = (client as unknown as Record<PropertyKey, unknown>)[key];
        return typeof value === "function" ? value.bind(client) : value;
      },
    },
  ),
}));
import { createChequeForActor, transitionChequeForActor } from "./money";
import { postJournalInTx } from "@/lib/accounting/service";
const companyId = randomUUID(),
  foreignCompanyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  bankLedger = randomUUID(),
  receivableLedger = randomUUID(),
  yearId = randomUUID(),
  accountId = randomUUID(),
  date = new Date("2026-10-09");
const actor = {
  id: userId,
  companyId,
  name: "Checkpoint Admin",
  email: `${userId}@example.test`,
  role: "ACCOUNT_USER" as const,
  isActive: true,
  managerType: null,
  salesRole: null,
  salesAccessActive: false,
  accountAccessActive: true,
  accountRole: "ACCOUNT_ADMIN" as const,
  branchAccessScope: "ALL_BRANCHES" as const,
  branchIds: [],
};
async function openCheque(journalEntryId?: string) {
  return createChequeForActor(actor, {
    branchId,
    moneyAccountId: accountId,
    chequeNumber: randomUUID(),
    chequeDate: date,
    partyName: "Checkpoint customer",
    status: "RECEIVED",
    journalEntryId,
  });
}
async function clearedCheque() {
  const journal = await client.$transaction((tx) =>
    postJournalInTx(tx, actor, {
      financialYearId: yearId,
      branchId,
      entryDate: date,
      sourceType: "CHEQUE_CHECKPOINT_TEST",
      sourceId: randomUUID(),
      lines: [
        { ledgerAccountId: bankLedger, debit: "1593", credit: "0" },
        { ledgerAccountId: receivableLedger, debit: "0", credit: "1593" },
      ],
    }),
  );
  const cheque = await openCheque(journal.id);
  await transitionChequeForActor(actor, cheque.id, "DEPOSITED", date);
  await transitionChequeForActor(actor, cheque.id, "CLEARED", date);
  return { cheque, journal };
}
describe.skipIf(!url)("A066 real database atomic cheque transitions", () => {
  beforeAll(async () => {
    await client.company.createMany({
      data: [
        {
          id: companyId,
          name: "Cheque checkpoint",
          slug: `cheque-${companyId}`,
          productEdition: "SALESPUNCH360_ACCOUNT",
        },
        {
          id: foreignCompanyId,
          name: "Other checkpoint",
          slug: `cheque-${foreignCompanyId}`,
          productEdition: "SALESPUNCH360_ACCOUNT",
        },
      ],
    });
    await client.branch.create({
      data: { id: branchId, companyId, name: "Main", code: "MAIN" },
    });
    await client.user.create({
      data: {
        id: userId,
        companyId,
        name: actor.name,
        email: actor.email,
        passwordHash: await hash(randomUUID()),
        role: "ACCOUNT_USER",
        accountRole: "ACCOUNT_ADMIN",
        accountAccessActive: true,
      },
    });
    await client.accountSettings.create({ data: { companyId } });
    await client.financialYear.create({
      data: {
        id: yearId,
        companyId,
        name: "2026-27",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
      },
    });
    await client.ledgerAccount.createMany({
      data: [
        {
          id: bankLedger,
          companyId,
          code: "100",
          name: "Bank",
          accountClass: "ASSET",
          normalBalance: "DEBIT",
        },
        {
          id: receivableLedger,
          companyId,
          code: "110",
          name: "Receivable",
          accountClass: "ASSET",
          normalBalance: "DEBIT",
        },
      ],
    });
    await client.moneyAccount.create({
      data: {
        id: accountId,
        companyId,
        branchId,
        type: "BANK",
        name: "Bank",
        ledgerAccountId: bankLedger,
      },
    });
  });
  afterAll(async () => {
    failAudit = null;
    await client.cheque.deleteMany({ where: { companyId } });
    await client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
      await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
      await tx.journalLine.deleteMany({ where: { companyId } });
      await tx.journalEntry.deleteMany({ where: { companyId } });
    });
    await client.accountOperationalAudit.deleteMany({ where: { companyId } });
    await client.accountingPeriodLock.deleteMany({ where: { companyId } });
    await client.numberingSeries.deleteMany({ where: { companyId } });
    await client.moneyAccount.deleteMany({ where: { companyId } });
    await client.ledgerAccount.deleteMany({ where: { companyId } });
    await client.financialYear.deleteMany({ where: { companyId } });
    await client.accountSettings.deleteMany({ where: { companyId } });
    await client.user.deleteMany({ where: { companyId } });
    await client.branch.deleteMany({ where: { companyId } });
    await client.company.deleteMany({
      where: { id: { in: [companyId, foreignCompanyId] } },
    });
    await client.$disconnect();
  });
  it("commits only one of incompatible deposit/cancel races", async () => {
    const cheque = await openCheque();
    const outcomes = await Promise.allSettled([
      transitionChequeForActor(actor, cheque.id, "DEPOSITED", date),
      transitionChequeForActor(actor, cheque.id, "CANCELLED", date),
    ]);
    expect(outcomes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((x) => x.status === "rejected")).toHaveLength(1);
    expect(
      await client.accountOperationalAudit.count({
        where: {
          companyId,
          entityId: cheque.id,
          eventType: "CHEQUE_STATUS_CHANGED",
        },
      }),
    ).toBe(1);
    expect(["DEPOSITED", "CANCELLED"]).toContain(
      (await client.cheque.findUniqueOrThrow({ where: { id: cheque.id } }))
        .status,
    );
  });
  it("rolls back reversal and cheque status when operational audit fails", async () => {
    const { cheque, journal } = await clearedCheque();
    failAudit = "CHEQUE_STATUS_CHANGED";
    try {
      await expect(
        transitionChequeForActor(actor, cheque.id, "BOUNCED", date),
      ).rejects.toThrow("injected cheque audit failure");
    } finally {
      failAudit = null;
    }
    expect(
      (await client.cheque.findUniqueOrThrow({ where: { id: cheque.id } }))
        .status,
    ).toBe("CLEARED");
    expect(
      (
        await client.journalEntry.findUniqueOrThrow({
          where: { id: journal.id },
        })
      ).status,
    ).toBe("POSTED");
    expect(
      await client.journalEntry.count({
        where: { companyId, reversalOfId: journal.id },
      }),
    ).toBe(0);
  });
  it("parallel bounce retries post one balanced reversal and one transition audit", async () => {
    const { cheque, journal } = await clearedCheque();
    await Promise.all([
      transitionChequeForActor(actor, cheque.id, "BOUNCED", date),
      transitionChequeForActor(actor, cheque.id, "BOUNCED", date),
    ]);
    const reversals = await client.journalEntry.findMany({
      where: { companyId, reversalOfId: journal.id },
      include: { lines: true },
    });
    expect(reversals).toHaveLength(1);
    expect(
      reversals[0].lines
        .reduce((n, l) => n.add(l.debit).sub(l.credit), new Prisma.Decimal(0))
        .isZero(),
    ).toBe(true);
    expect(
      (
        await client.journalEntry.findUniqueOrThrow({
          where: { id: journal.id },
        })
      ).status,
    ).toBe("REVERSED");
    expect(
      (await client.cheque.findUniqueOrThrow({ where: { id: cheque.id } }))
        .status,
    ).toBe("BOUNCED");
    expect(
      await client.accountOperationalAudit.count({
        where: {
          companyId,
          entityId: cheque.id,
          eventType: "CHEQUE_STATUS_CHANGED",
          metadata: { path: ["to"], equals: "BOUNCED" },
        },
      }),
    ).toBe(1);
  });
  it("rolls back creation on audit failure", async () => {
    const count = await client.cheque.count({ where: { companyId } });
    failAudit = "CHEQUE_CREATED";
    try {
      await expect(openCheque()).rejects.toThrow(
        "injected cheque audit failure",
      );
    } finally {
      failAudit = null;
    }
    expect(await client.cheque.count({ where: { companyId } })).toBe(count);
  });
  it("enforces company, branch and money-entry permission on transitions", async () => {
    const cheque = await openCheque();
    for (const denied of [
      { ...actor, companyId: foreignCompanyId },
      {
        ...actor,
        branchAccessScope: "SELECTED_BRANCHES" as const,
        branchIds: [],
      },
      { ...actor, accountRole: "DATA_ENTRY" as const },
    ])
      await expect(
        transitionChequeForActor(denied, cheque.id, "DEPOSITED", date),
      ).rejects.toThrow();
    expect(
      (await client.cheque.findUniqueOrThrow({ where: { id: cheque.id } }))
        .status,
    ).toBe("RECEIVED");
  });
  it("period lock rejects bounce and preserves cheque and journal", async () => {
    const { cheque, journal } = await clearedCheque();
    await client.accountingPeriodLock.create({
      data: {
        companyId,
        financialYearId: yearId,
        lockedThrough: date,
        updatedById: userId,
      },
    });
    try {
      await expect(
        transitionChequeForActor(actor, cheque.id, "BOUNCED", date),
      ).rejects.toThrow("PERIOD_LOCKED");
    } finally {
      await client.accountingPeriodLock.deleteMany({ where: { companyId } });
    }
    expect(
      (await client.cheque.findUniqueOrThrow({ where: { id: cheque.id } }))
        .status,
    ).toBe("CLEARED");
    expect(
      (
        await client.journalEntry.findUniqueOrThrow({
          where: { id: journal.id },
        })
      ).status,
    ).toBe("POSTED");
  });
});
