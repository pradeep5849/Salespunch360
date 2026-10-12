import { randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { PrismaClient, Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
let companyLockObserved: (() => void) | null = null;
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
                      if (name === "$queryRaw")
                        return (
                          ...args: Parameters<typeof target.$queryRaw>
                        ) => {
                          if (
                            companyLockObserved &&
                            String(args[0]).includes('"companies"')
                          )
                            companyLockObserved();
                          return target.$queryRaw(...args);
                        };
                      return target[name as keyof typeof target];
                    },
                  }),
                ),
              options,
            );
        const value = client[key as keyof typeof client];
        return typeof value === "function" ? value.bind(client) : value;
      },
    },
  ),
}));
import { moneyDashboardForActor, postOwnerTransactionForActor } from "./money";
import {
  postJournalInTx,
  reverseJournalForActor,
} from "@/lib/accounting/service";
const companyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  yearId = randomUUID(),
  ownerId = randomUUID(),
  capitalId = randomUUID(),
  drawingsId = randomUUID(),
  loanId = randomUUID(),
  date = new Date("2026-10-09");
const actor = {
  id: userId,
  companyId,
  name: "Funds owner",
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
const raw = (
  accountId: string,
  type: "INVESTMENT" | "WITHDRAWAL",
  amount: string,
  key = randomUUID(),
) => ({
  ownerFinancialAccountId: ownerId,
  moneyAccountId: accountId,
  branchId,
  type,
  amount,
  transactionDate: date,
  idempotencyKey: key,
});
async function account() {
  const ledger = await client.ledgerAccount.create({
    data: {
      companyId,
      code: randomUUID().slice(0, 20),
      name: randomUUID(),
      accountClass: "ASSET",
      normalBalance: "DEBIT",
    },
  });
  const row = await client.moneyAccount.create({
    data: {
      companyId,
      branchId,
      type: "BANK",
      name: randomUUID(),
      ledgerAccountId: ledger.id,
    },
  });
  return row;
}
async function funds(ledgerAccountId: string) {
  const rows = await client.journalLine.aggregate({
    where: {
      companyId,
      ledgerAccountId,
      journalEntry: { status: { in: ["POSTED", "REVERSED"] } },
    },
    _sum: { debit: true, credit: true },
  });
  return new Prisma.Decimal(rows._sum.debit ?? 0).sub(rows._sum.credit ?? 0);
}
describe.skipIf(!url)("A065 authoritative available owner funds", () => {
  beforeAll(async () => {
    await client.company.create({
      data: {
        id: companyId,
        name: "Owner funds checkpoint",
        slug: `funds-${companyId}`,
        productEdition: "SALESPUNCH360_ACCOUNT",
      },
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
          id: capitalId,
          companyId,
          code: "300",
          name: "Capital",
          accountClass: "EQUITY",
          normalBalance: "CREDIT",
        },
        {
          id: drawingsId,
          companyId,
          code: "310",
          name: "Drawings",
          accountClass: "EQUITY",
          normalBalance: "DEBIT",
        },
        {
          id: loanId,
          companyId,
          code: "220",
          name: "Owner loan",
          accountClass: "LIABILITY",
          normalBalance: "CREDIT",
        },
      ],
    });
    await client.ownerFinancialAccount.create({
      data: {
        id: ownerId,
        companyId,
        userId,
        capitalLedgerId: capitalId,
        drawingsLedgerId: drawingsId,
        loanLedgerId: loanId,
      },
    });
  });
  afterAll(async () => {
    companyLockObserved = null;
    await client.ownerTransaction.deleteMany({ where: { companyId } });
    await client.ownerFinancialAccount.deleteMany({ where: { companyId } });
    await client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
      await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
      await tx.journalLine.deleteMany({ where: { companyId } });
      await tx.journalEntry.deleteMany({ where: { companyId } });
    });
    await client.accountOperationalAudit.deleteMany({ where: { companyId } });
    await client.moneyAccount.deleteMany({ where: { companyId } });
    await client.ledgerAccount.deleteMany({ where: { companyId } });
    await client.numberingSeries.deleteMany({ where: { companyId } });
    await client.financialYear.deleteMany({ where: { companyId } });
    await client.accountSettings.deleteMany({ where: { companyId } });
    await client.user.deleteMany({ where: { companyId } });
    await client.branch.deleteMany({ where: { companyId } });
    await client.company.delete({ where: { id: companyId } });
    await client.$disconnect();
  });
  it("rejects insufficient funds without posting a journal, owner record or audit", async () => {
    const bank = await account();
    await postOwnerTransactionForActor(
      actor,
      raw(bank.id, "INVESTMENT", "100"),
    );
    const before = [
      await client.journalEntry.count({ where: { companyId } }),
      await client.ownerTransaction.count({ where: { companyId } }),
      await client.accountOperationalAudit.count({ where: { companyId } }),
    ];
    await expect(
      postOwnerTransactionForActor(actor, raw(bank.id, "WITHDRAWAL", "100.01")),
    ).rejects.toThrow("INSUFFICIENT_MONEY_BALANCE");
    expect([
      await client.journalEntry.count({ where: { companyId } }),
      await client.ownerTransaction.count({ where: { companyId } }),
      await client.accountOperationalAudit.count({ where: { companyId } }),
    ]).toEqual(before);
    expect((await funds(bank.ledgerAccountId)).toFixed(2)).toBe("100.00");
  });
  it("serializes competing withdrawals against the same available balance", async () => {
    const bank = await account();
    await postOwnerTransactionForActor(
      actor,
      raw(bank.id, "INVESTMENT", "100"),
    );
    const results = await Promise.allSettled([
      postOwnerTransactionForActor(actor, raw(bank.id, "WITHDRAWAL", "80")),
      postOwnerTransactionForActor(actor, raw(bank.id, "WITHDRAWAL", "80")),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect((await funds(bank.ledgerAccountId)).toFixed(2)).toBe("20.00");
  });
  it("counts original and reversing journal lines correctly when checking new funds", async () => {
    const bank = await account();
    const investment = await postOwnerTransactionForActor(
      actor,
      raw(bank.id, "INVESTMENT", "100"),
    );
    await reverseJournalForActor(actor, {
      journalEntryId: investment.journalEntryId,
      entryDate: date,
      reason: "Checkpoint funding correction",
    });
    await postOwnerTransactionForActor(actor, raw(bank.id, "INVESTMENT", "30"));
    expect((await funds(bank.ledgerAccountId)).toFixed(2)).toBe("30.00");
    await postOwnerTransactionForActor(actor, raw(bank.id, "WITHDRAWAL", "30"));
    expect((await funds(bank.ledgerAccountId)).toFixed(2)).toBe("0.00");
  });
  it("money dashboard agrees with effective reversed journal balances", async () => {
    const bank = await account();
    const investment = await postOwnerTransactionForActor(
      actor,
      raw(bank.id, "INVESTMENT", "100"),
    );
    await reverseJournalForActor(actor, {
      journalEntryId: investment.journalEntryId,
      entryDate: date,
      reason: "Dashboard reversal test",
    });
    await postOwnerTransactionForActor(actor, raw(bank.id, "INVESTMENT", "30"));
    const dashboard = await moneyDashboardForActor(actor);
    expect(
      dashboard.accounts.find((row) => row.id === bank.id)?.balance.toFixed(2),
    ).toBe("30.00");
  });
  it("shared account display includes only journals in assigned branches", async () => {
    const second = await client.branch.create({
      data: { companyId, name: "Other", code: "OTHER" },
    });
    const bank = await account();
    await client.moneyAccount.update({
      where: { id: bank.id },
      data: { branchId: null },
    });
    await postOwnerTransactionForActor(
      actor,
      raw(bank.id, "INVESTMENT", "100"),
    );
    await postOwnerTransactionForActor(actor, {
      ...raw(bank.id, "INVESTMENT", "200"),
      branchId: second.id,
    });
    const restricted = await moneyDashboardForActor({
      ...actor,
      branchAccessScope: "SELECTED_BRANCHES",
      branchIds: [branchId],
    });
    expect(
      restricted.accounts.find((row) => row.id === bank.id)?.balance.toFixed(2),
    ).toBe("100.00");
    const all = await moneyDashboardForActor(actor);
    expect(
      all.accounts.find((row) => row.id === bank.id)?.balance.toFixed(2),
    ).toBe("300.00");
  });
  it("reads funds after another journal writer releases the company posting lock", async () => {
    const bank = await account(),
      destination = await account();
    await postOwnerTransactionForActor(
      actor,
      raw(bank.id, "INVESTMENT", "100"),
    );
    let release!: () => void, locked!: () => void, observed!: () => void;
    const held = new Promise<void>((resolve) => {
        release = resolve;
      }),
      lockedSignal = new Promise<void>((resolve) => {
        locked = resolve;
      }),
      observedSignal = new Promise<void>((resolve) => {
        observed = resolve;
      });
    const outgoing = client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "companies" WHERE "id"=${companyId}::uuid FOR UPDATE`;
      await postJournalInTx(tx, actor, {
        financialYearId: yearId,
        branchId,
        entryDate: date,
        sourceType: "CHECKPOINT_TRANSFER",
        sourceId: randomUUID(),
        lines: [
          { ledgerAccountId: bank.ledgerAccountId, debit: "0", credit: "60" },
          {
            ledgerAccountId: destination.ledgerAccountId,
            debit: "60",
            credit: "0",
          },
        ],
      });
      locked();
      await held;
    });
    await lockedSignal;
    companyLockObserved = observed;
    const withdrawal = postOwnerTransactionForActor(
      actor,
      raw(bank.id, "WITHDRAWAL", "80"),
    );
    const rejected = expect(withdrawal).rejects.toThrow(
      "INSUFFICIENT_MONEY_BALANCE",
    );
    try {
      await Promise.race([
        observedSignal,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Owner posting lock not reached")),
            2000,
          ),
        ),
      ]);
    } finally {
      companyLockObserved = null;
      release();
    }
    await outgoing;
    await rejected;
    expect((await funds(bank.ledgerAccountId)).toFixed(2)).toBe("40.00");
  });
});
