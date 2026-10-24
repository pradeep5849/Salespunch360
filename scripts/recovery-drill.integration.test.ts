import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  fingerprint,
  assertRestoredState,
  type RecoveryFingerprint,
} from "./recovery-fingerprint.mjs";
import { postJournalInTx } from "../src/lib/accounting/service";
const url = process.env.ACCOUNT_RECOVERY_DATABASE_URL;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error(
    "Recovery integration requires an isolated local *_ci database",
  );
const companyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  fyId = randomUUID(),
  cashId = randomUUID(),
  capitalId = randomUUID(),
  name = "Isolated restore fixture";
const database = `a088_${randomUUID().replaceAll("-", "")}_restore_drill`;
let source: PrismaClient,
  target: PrismaClient,
  expected: RecoveryFingerprint,
  created = false;
const snapshot = (client: PrismaClient) =>
  client.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
      return fingerprint(tx);
    },
    { isolationLevel: "RepeatableRead", timeout: 60000 },
  );
function run() {
  const targetUrl = new URL(url!);
  targetUrl.pathname = `/${database}`;
  return spawnSync(process.execPath, ["scripts/recovery-drill.mjs"], {
    encoding: "utf8",
    timeout: 120000,
    env: {
      ...process.env,
      DIRECT_URL: url,
      RESTORE_DRILL_DATABASE_URL: targetUrl.href,
    },
  });
}
describe.skipIf(!url)("A088 actual isolated database recovery", () => {
  beforeAll(async () => {
    source = new PrismaClient({ datasources: { db: { url: url! } } });
    await source.company.create({
      data: {
        id: companyId,
        name,
        slug: `restore-${companyId}`,
        productEdition: "SALESPUNCH360_ACCOUNT",
      },
    });
    await source.branch.create({
      data: {
        id: branchId,
        companyId,
        name: "Restore branch",
        code: "RESTORE",
      },
    });
    await source.user.create({
      data: {
        id: userId,
        companyId,
        name: "Restore admin",
        email: `${userId}@example.test`,
        passwordHash: "not-a-login",
        role: "ACCOUNT_USER",
        accountRole: "ACCOUNT_ADMIN",
      },
    });
    await source.financialYear.create({
      data: {
        id: fyId,
        companyId,
        name: "Restore year",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
      },
    });
    await source.ledgerAccount.createMany({
      data: [
        {
          id: cashId,
          companyId,
          code: "RESTORE-CASH",
          name: "Restore Cash",
          accountClass: "ASSET",
          normalBalance: "DEBIT",
        },
        {
          id: capitalId,
          companyId,
          code: "RESTORE-CAPITAL",
          name: "Restore Capital",
          accountClass: "EQUITY",
          normalBalance: "CREDIT",
        },
      ],
    });
    await source.$transaction((tx) =>
      postJournalInTx(
        tx,
        { id: userId, companyId, branchAccessScope: "ALL_BRANCHES" },
        {
          financialYearId: fyId,
          branchId,
          entryDate: "2026-10-23",
          sourceType: "MANUAL_JOURNAL",
          sourceId: randomUUID(),
          lines: [
            { ledgerAccountId: cashId, debit: "123.45", credit: "0" },
            { ledgerAccountId: capitalId, debit: "0", credit: "123.45" },
          ],
        },
      ),
    );
    await source.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
    created = true;
    const targetUrl = new URL(url!);
    targetUrl.pathname = `/${database}`;
    target = new PrismaClient({ datasources: { db: { url: targetUrl.href } } });
    expected = await snapshot(source);
  }, 180000);
  afterAll(async () => {
    await target?.$disconnect();
    // Only the fresh UUID-named database created by this test is disposable.
    // No pre-existing database is reset, restored into or dropped.
    if (created && /^a088_[a-f0-9]{32}_restore_drill$/.test(database))
      await source.$executeRawUnsafe(`DROP DATABASE "${database}"`);
    if (source) {
      await source.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
        await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
        await tx.journalLine.deleteMany({ where: { companyId } });
        await tx.journalEntry.deleteMany({ where: { companyId } });
        await tx.numberingSeries.deleteMany({ where: { companyId } });
        await tx.ledgerAccount.deleteMany({ where: { companyId } });
        await tx.financialYear.deleteMany({ where: { companyId } });
        await tx.user.deleteMany({ where: { companyId } });
        await tx.branch.deleteMany({ where: { companyId } });
        await tx.company.deleteMany({ where: { id: companyId } });
      });
      await source.$disconnect();
    }
  }, 180000);
  it("restores every table and integrity object including exact posted ledger amounts", async () => {
    const result = run();
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("tables and");
    assertRestoredState(expected, await snapshot(target));
    const lines = await target.journalLine.findMany({
      where: { companyId },
      orderBy: { lineNumber: "asc" },
    });
    expect(
      lines.map((row) => [row.debit.toString(), row.credit.toString()]),
    ).toEqual([
      ["123.45", "0"],
      ["0", "123.45"],
    ]);
    expect(
      expected.rows.find((row) => row.table === "project_material_movements"),
    ).toBeDefined();
  }, 180000);
  it("refuses an existing target without overwriting or deleting restored records", async () => {
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("empty-target validation");
    assertRestoredState(expected, await snapshot(target));
  }, 180000);
  it("detects changed content even when every table row count stays the same", async () => {
    const original = await target.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { name: true, updatedAt: true },
    });
    await target.company.update({
      where: { id: companyId },
      data: { name: "Changed restored content" },
    });
    try {
      const changed = await snapshot(target);
      expect(changed.rows.map((row) => [row.table, row.count])).toEqual(
        expected.rows.map((row) => [row.table, row.count]),
      );
      expect(() => assertRestoredState(expected, changed)).toThrow("differ");
    } finally {
      await target.company.update({ where: { id: companyId }, data: original });
    }
  });
  it("detects column type changes that preserve all restored row values", async () => {
    await target.$executeRawUnsafe(
      "ALTER TABLE public._prisma_migrations ALTER COLUMN logs TYPE varchar(500000)",
    );
    try {
      const changed = await snapshot(target);
      expect(changed.rows).toEqual(expected.rows);
      expect(() => assertRestoredState(expected, changed)).toThrow("differ");
    } finally {
      await target.$executeRawUnsafe(
        "ALTER TABLE public._prisma_migrations ALTER COLUMN logs TYPE text",
      );
    }
  });
  it("detects a weakened CHECK rather than discarding casts or parentheses from its expression", async () => {
    await target.$executeRawUnsafe(
      "ALTER TABLE public.billing_orders DROP CONSTRAINT order_seats_check",
    );
    await target.$executeRawUnsafe(
      'ALTER TABLE public.billing_orders ADD CONSTRAINT order_seats_check CHECK ("adminSeats" >= -1)',
    );
    const changed = await snapshot(target);
    expect(() => assertRestoredState(expected, changed)).toThrow("differ");
    assertRestoredState(expected, await snapshot(source));
  });
});
