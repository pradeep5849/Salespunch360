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
    it("retains legacy account rows without inventing creation identities",async()=>{
    expect(await client.moneyAccount.findUniqueOrThrow({where:{id:accountId}})).toMatchObject({creationRequestKey:null,creationRequestHash:null});
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
  },
);
