import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const url = process.env.RESTORE_TEST_DATABASE_URL;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error("Isolated local *_ci database required");
const client = new PrismaClient({
  datasources: {
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/restore_ci" },
  },
});
const storage = new Map<string, Buffer>();
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }),
}));
vi.mock("@/lib/storage", () => ({
  privateStorage: () => ({
    get: async (key: string) => {
      const bytes = storage.get(key);
      if (!bytes) throw new Error("MISSING");
      return bytes;
    },
    put: async (key: string, bytes: Buffer) => {
      storage.set(key, bytes);
    },
    delete: async (key: string) => {
      storage.delete(key);
    },
  }),
}));
import { createAccountBackupForActor } from "./utilities";
import {
  prepareCompanyRestore,
  executeCompanyRestore,
} from "./company-restore";
const companyId = randomUUID(),
  foreignId = randomUUID(),
  userId = randomUUID(),
  branchId = randomUUID(),
  fyId = randomUUID(),
  journalId = randomUUID();
const ledgerIds = [randomUUID(), randomUUID()];
const actor = { id: userId, companyId, accountRole: "ACCOUNT_ADMIN" };
describe.skipIf(!url)(
  "existing-company restore with real PostgreSQL constraints",
  () => {
    beforeAll(async () => {
      await client.company.createMany({
        data: [
          {
            id: companyId,
            name: "Restore fixture",
            slug: `restore-${companyId}`,
            productEdition: "SALESPUNCH360_ACCOUNT",
          },
          {
            id: foreignId,
            name: "Foreign fixture",
            slug: `restore-${foreignId}`,
            productEdition: "SALESPUNCH360_ACCOUNT",
          },
        ],
      });
      await client.user.create({
        data: {
          id: userId,
          companyId,
          name: "Owner",
          email: `${userId}@example.test`,
          passwordHash: "fixture-only-password-hash",
          role: "COMPANY_ADMIN",
          accountRole: "ACCOUNT_ADMIN",
          accountAccessActive: true,
        },
      });
      await client.branch.create({
        data: { id: branchId, companyId, name: "Main", code: "MAIN" },
      });
      await client.financialYear.create({
        data: {
          id: fyId,
          companyId,
          name: "FY",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2027-03-31"),
        },
      });
      await client.accountSettings.create({ data: { companyId } });
      await client.ledgerAccount.createMany({
        data: [
          {
            id: ledgerIds[0],
            companyId,
            code: "FIXTURE_ASSET",
            name: "Fixture asset",
            accountClass: "ASSET",
            normalBalance: "DEBIT",
          },
          {
            id: ledgerIds[1],
            companyId,
            code: "FIXTURE_EQUITY",
            name: "Fixture equity",
            accountClass: "EQUITY",
            normalBalance: "CREDIT",
          },
        ],
      });
      await client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.company_restore_company_id',${companyId},true)`;
        await tx.journalEntry.create({
          data: {
            id: journalId,
            companyId,
            branchId,
            financialYearId: fyId,
            journalNumber: "FIXTURE1",
            entryDate: new Date("2026-11-05"),
            sourceType: "FIXTURE",
            sourceId: journalId,
            createdById: userId,
            status: "POSTED",
            postedById: userId,
            postedAt: new Date(),
          },
        });
        await tx.journalLine.createMany({
          data: [
            {
              companyId,
              journalEntryId: journalId,
              lineNumber: 1,
              ledgerAccountId: ledgerIds[0],
              debit: "100",
              credit: "0",
            },
            {
              companyId,
              journalEntryId: journalId,
              lineNumber: 2,
              ledgerAccountId: ledgerIds[1],
              debit: "0",
              credit: "100",
            },
          ],
        });
      });
      await client.vendor.createMany({
        data: [
          { companyId, name: "Saved vendor" },
          { companyId: foreignId, name: "Foreign vendor" },
        ],
      });
    });

    it("keeps normal immutable-history guards active", async () => {
      await expect(
        client.journalEntry.delete({ where: { id: journalId } }),
      ).rejects.toThrow();
      expect(
        await client.journalEntry.count({ where: { id: journalId } }),
      ).toBe(1);
    });
    it("restores the original company, removes later entries, retains identity and other tenants, and is replay-safe", async () => {
      const logoKey = `companies/${companyId}/logos/restored-fixture.png`;
      storage.set(logoKey, Buffer.from("fixture-logo-bytes"));
      await client.company.update({where:{id:companyId},data:{logoObjectKey:logoKey}});
      const backup = await createAccountBackupForActor(
        actor,
        false,
        true,
        undefined,
        undefined,
        true,
      );
      const bundle = JSON.parse(new TextDecoder().decode(backup.bytes));
      expect(bundle.manifest.formatVersion).toBe(4);
      expect(bundle.data.restoreSnapshot.models.JournalEntry[0].entryDate).toBe(
        "2026-11-05T00:00:00.000Z",
      );
      const later = await client.vendor.create({
        data: { companyId, name: "After backup" },
      });
      await client.vendor.updateMany({
        where: { companyId, name: "Saved vendor" },
        data: { name: "Changed after backup" },
      });
      await client.pendingStorageDeletion.create({data:{companyId,objectKey:logoKey}});
      const review = await prepareCompanyRestore(actor, backup.bytes);
      expect(await client.vendor.count({ where: { companyId } })).toBe(2);
      expect(
        await executeCompanyRestore(actor, {
          reviewId: review.id,
          companyName: review.companyName,
          confirmed: true,
        }),
      ).toMatchObject({ restored: true, idempotent: false });
      expect(await client.pendingStorageDeletion.count({where:{companyId,objectKey:logoKey}})).toBe(0);
      expect(storage.get(logoKey)?.toString()).toBe("fixture-logo-bytes");
      expect(
        await client.vendor.findUnique({ where: { id: later.id } }),
      ).toBeNull();
      expect(
        (await client.vendor.findMany({ where: { companyId } })).map(
          (row) => row.name,
        ),
      ).toEqual(["Saved vendor"]);
      expect(
        await client.vendor.count({ where: { companyId: foreignId } }),
      ).toBe(1);
      expect(
        await client.user.findUnique({
          where: { id: userId },
          select: { passwordHash: true },
        }),
      ).toEqual({ passwordHash: "fixture-only-password-hash" });
      expect(
        await client.journalEntry.count({ where: { id: journalId } }),
      ).toBe(1);
      expect(
        await executeCompanyRestore(actor, {
          reviewId: review.id,
          companyName: review.companyName,
          confirmed: true,
        }),
      ).toMatchObject({ restored: true, idempotent: true });
      await expect(
        client.journalEntry.delete({ where: { id: journalId } }),
      ).rejects.toThrow();
    }, 120000);
    it("rejects cross-company, modified and stale-review backups before deleting business data", async () => {
      const backup = await createAccountBackupForActor(
        actor,
        false,
        true,
        undefined,
        undefined,
        true,
      );
      await expect(
        prepareCompanyRestore({ ...actor, companyId: foreignId }, backup.bytes),
      ).rejects.toThrow();
      const edited = JSON.parse(new TextDecoder().decode(backup.bytes));
      edited.data.restoreSnapshot.models.Vendor[0].name = "tampered";
      await expect(
        prepareCompanyRestore(
          actor,
          new TextEncoder().encode(JSON.stringify(edited)),
        ),
      ).rejects.toThrow("RESTORE_UNRECOGNIZED_BACKUP");
      const review = await prepareCompanyRestore(actor, backup.bytes);
      await client.vendor.create({
        data: { companyId, name: "Concurrent entry" },
      });
      await expect(
        executeCompanyRestore(actor, {
          reviewId: review.id,
          companyName: review.companyName,
          confirmed: true,
        }),
      ).rejects.toThrow("RESTORE_COMPANY_CHANGED_REVIEW_AGAIN");
      expect(
        await client.vendor.count({
          where: { companyId, name: "Concurrent entry" },
        }),
      ).toBe(1);
    }, 120000);
  },
);
describe.skipIf(!url)("restore rollback boundary", () => {
  it("rolls back the entire replacement when preserved identity references cannot be restored", async () => {
    const temporaryUser = await client.user.create({
      data: {
        companyId,
        name: "Temporary fixture",
        email: `${randomUUID()}@example.test`,
        passwordHash: "fixture",
        role: "ACCOUNT_USER",
        accountRole: "ACCOUNTANT",
        accountAccessActive: true,
      },
    });
    const missingJournalId = randomUUID();
    await client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.company_restore_company_id',${companyId},true)`;
      await tx.journalEntry.create({
        data: {
          id: missingJournalId,
          companyId,
          branchId,
          financialYearId: fyId,
          journalNumber: "MISSING_USER",
          entryDate: new Date("2026-11-05"),
          sourceType: "FIXTURE",
          sourceId: missingJournalId,
          createdById: temporaryUser.id,
          status: "POSTED",
          postedById: temporaryUser.id,
          postedAt: new Date(),
        },
      });
    });
    const backup = await createAccountBackupForActor(
      actor,
      false,
      true,
      undefined,
      undefined,
      true,
    );
    await client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.company_restore_company_id',${companyId},true)`;
      await tx.journalEntry.delete({ where: { id: missingJournalId } });
    });
    await client.user.delete({ where: { id: temporaryUser.id } });
    const retained = await client.vendor.create({
      data: { companyId, name: "Keep on failed restore" },
    });
    const review = await prepareCompanyRestore(actor, backup.bytes);
    await expect(
      executeCompanyRestore(actor, {
        reviewId: review.id,
        companyName: review.companyName,
        confirmed: true,
      }),
    ).rejects.toThrow();
    expect(
      await client.vendor.findUnique({ where: { id: retained.id } }),
    ).not.toBeNull();
    expect(
      await client.journalEntry.findUnique({ where: { id: missingJournalId } }),
    ).toBeNull();
  }, 120000);
});

afterAll(async () => {
  await client.$disconnect();
});
