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
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/evidence_ci" },
  },
});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }),
}));
const storage = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
  put: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({
  privateStorage: () => ({
    put: storage.put,
    get: storage.get,
    delete: storage.remove,
  }),
}));
import { DEFAULT_LEDGER_ACCOUNTS } from "@/lib/accounting/default-accounts";
import {
  submitPaymentForActor,
  downloadPaymentAttachmentForActor,
} from "./payment-submission";
import { readRestoreSnapshot } from "./restore-snapshot";
import { collectBackupPrivateFiles } from "./backup-private-files";
import { chequeFinancialActionForActor } from "./cheque-finance";
const companyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  customerId = randomUUID();
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
const input = () => ({
  type: "CUSTOMER_ADVANCE",
  branchId,
  partyId: customerId,
  paymentMode: "CASH",
  amount: "100",
  transactionDate: "2026-11-05",
  idempotencyKey: randomUUID(),
  billingName: "Invoice addressee",
  billingAddress: "Billing address",
});
const pdf = (content = "fixture") =>
  new File([`%PDF-1.7\n${content}`], "../receipt.pdf", {
    type: "application/pdf",
  });
describe.skipIf(!url)("atomic payment supporting evidence and recovery", () => {
  beforeAll(async () => {
    storage.put.mockImplementation(async (key: string, bytes: Buffer) => {
      storage.files.set(key, Buffer.from(bytes));
    });
    storage.get.mockImplementation(async (key: string) => {
      const bytes = storage.files.get(key);
      if (!bytes) throw new Error("MISSING_FILE");
      return bytes;
    });
    storage.remove.mockImplementation(async (key: string) => {
      storage.files.delete(key);
    });
    await client.company.create({
      data: {
        id: companyId,
        name: "Payment evidence fixture",
        slug: `evidence-${companyId}`,
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
    await client.customer.create({
      data: {
        id: customerId,
        companyId,
        branchId,
        name: "Buyer",
        isAccountCustomer: true,
      },
    });
  });
  afterAll(async () => {
    await client.$disconnect();
  });
  it("binds immutable billing and files to one payment, retries once and includes exact bytes in recovery", async () => {
    const request = input(),
      payment = await submitPaymentForActor(actor, request, [pdf()]);
    expect(payment.billingName).toBe("Invoice addressee");
    expect(payment.billingAddress).toBe("Billing address");
    const file = await client.paymentAttachment.findFirstOrThrow({
      where: { companyId, settlementId: payment.id },
    });
    expect(file.displayName).toBe("receipt.pdf");
    expect(
      (
        await downloadPaymentAttachmentForActor(actor, file.id)
      ).bytes.toString(),
    ).toBe("%PDF-1.7\nfixture");
    expect((await submitPaymentForActor(actor, request, [pdf()])).id).toBe(
      payment.id,
    );
    expect(await client.accountSettlement.count({ where: { companyId } })).toBe(
      1,
    );
    expect(storage.put).toHaveBeenCalledTimes(1);
    await expect(
      submitPaymentForActor(actor, request, [pdf("changed")]),
    ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
    expect(await client.paymentAttachment.count({ where: { companyId } })).toBe(
      1,
    );
    const snapshot = await client.$transaction((tx) =>
      readRestoreSnapshot(tx, companyId),
    );
    expect(snapshot.models.PaymentAttachment).toHaveLength(1);
    const files = await collectBackupPrivateFiles(companyId, snapshot.models, {
      get: storage.get,
    });
    expect(files).toHaveLength(1);
    expect(Buffer.from(files[0].data, "base64").toString()).toBe(
      "%PDF-1.7\nfixture",
    );
    await expect(
      client.paymentAttachment.update({
        where: { id: file.id },
        data: { displayName: "changed.pdf" },
      }),
    ).rejects.toThrow();
    await expect(
      client.accountSettlement.update({
        where: { id: payment.id },
        data: { billingName: "Changed history" },
      }),
    ).rejects.toThrow();
  });
  it("denies other companies, branches and unauthorized writers before storage access", async () => {
    const file = await client.paymentAttachment.findFirstOrThrow({
        where: { companyId },
      }),
      reads = storage.get.mock.calls.length,
      writes = storage.put.mock.calls.length;
    await expect(
      downloadPaymentAttachmentForActor(
        { ...actor, companyId: randomUUID() },
        file.id,
      ),
    ).rejects.toThrow("Not authorized");
    await expect(
      downloadPaymentAttachmentForActor(
        { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
        file.id,
      ),
    ).rejects.toThrow("Not authorized");
    await expect(
      submitPaymentForActor({ ...actor, accountRole: "DATA_ENTRY" }, input(), [
        pdf(),
      ]),
    ).rejects.toThrow("Not authorized");
    expect(storage.get).toHaveBeenCalledTimes(reads);
    expect(storage.put).toHaveBeenCalledTimes(writes);
  });
  it("rolls back cash and metadata when evidence storage fails and removes only uncommitted bytes", async () => {
    const settlements = await client.accountSettlement.count({
        where: { companyId },
      }),
      journals = await client.journalEntry.count({ where: { companyId } }),
      files = storage.files.size;
    storage.put
      .mockImplementationOnce(async (key: string, bytes: Buffer) => {
        storage.files.set(key, Buffer.from(bytes));
      })
      .mockRejectedValueOnce(new Error("PHOTO_STORAGE_UNAVAILABLE"));
    await expect(
      submitPaymentForActor(actor, input(), [pdf("first"), pdf("second")]),
    ).rejects.toThrow("PHOTO_STORAGE_UNAVAILABLE");
    expect(await client.accountSettlement.count({ where: { companyId } })).toBe(
      settlements,
    );
    expect(await client.journalEntry.count({ where: { companyId } })).toBe(
      journals,
    );
    expect(storage.files.size).toBe(files);
  });
  it("retains the original evidence and billing identity across cheque reopen and clearance", async () => {
    const ledger = await client.ledgerAccount.findFirstOrThrow({
      where: { companyId, systemKey: "BANK" },
    });
    const bank = await client.moneyAccount.create({
      data: {
        companyId,
        branchId,
        name: "Evidence bank",
        type: "BANK",
        ledgerAccountId: ledger.id,
      },
    });
    const payment = await submitPaymentForActor(
      actor,
      {
        ...input(),
        paymentMode: "CHEQUE",
        moneyAccountId: bank.id,
        chequeNumber: "EVIDENCE-1",
        chequeDate: "2026-11-05",
      },
      [pdf("cheque proof")],
    );
    const cheque = await client.cheque.findFirstOrThrow({
      where: { companyId, settlementId: payment.id },
    });
    await chequeFinancialActionForActor(actor, cheque.id, {
      action: "CLOSE",
      requestKey: randomUUID(),
      expectedVersion: 0,
      actionDate: "2026-11-06",
      moneyAccountId: bank.id,
    });
    await chequeFinancialActionForActor(actor, cheque.id, {
      action: "REOPEN",
      requestKey: randomUUID(),
      expectedVersion: 1,
      actionDate: "2026-11-07",
      reason: "Recheck evidence cheque",
    });
    const cleared = await chequeFinancialActionForActor(actor, cheque.id, {
      action: "CLOSE",
      requestKey: randomUUID(),
      expectedVersion: 2,
      actionDate: "2026-11-08",
      moneyAccountId: bank.id,
    });
    expect(cleared.settlementId).not.toBe(payment.id);
    const previous = await client.paymentAttachment.findFirstOrThrow({
        where: { companyId, settlementId: payment.id },
      }),
      current = await client.paymentAttachment.findFirstOrThrow({
        where: { companyId, settlementId: cleared.settlementId! },
      });
    expect(current.storageKey).toBe(previous.storageKey);
    expect(current.contentHash).toBe(previous.contentHash);
    expect(
      (
        await client.accountSettlement.findUniqueOrThrow({
          where: { id: cleared.settlementId! },
        })
      ).billingName,
    ).toBe("Invoice addressee");
    expect(
      (
        await downloadPaymentAttachmentForActor(actor, current.id)
      ).bytes.toString(),
    ).toBe("%PDF-1.7\ncheque proof");
  });
});
