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
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
import { saveBusinessCurrency } from "./business-currency";
import {
  reverseJournalForActor,
  postJournalInTx,
} from "@/lib/accounting/service";
import { createChequeForActor } from "./money";
import { saleDetailForActor } from "./sale-detail";
import { currentPartyBalanceForActor } from "./party-balance";
import {
  reversePostedSaleForActor,
  replacePostedSaleForActor,
} from "./sale-amendments";
import { DEFAULT_LEDGER_ACCOUNTS } from "@/lib/accounting/default-accounts";
import {
  createCommercialDocumentForActor,
  postCommercialDocumentForActor,
  createSettlementForActor,
  documentOutstandingInTx,
  applyAdvanceForActor,
} from "./commercial";
import {
  chequeFinancialActionForActor,
  completeLegacyChequeSourceForActor,
} from "./cheque-finance";
import type { ProjectActor } from "./projects";
const companyId = randomUUID(),
  branchId = randomUUID(),
  otherBranch = randomUUID(),
  userId = randomUUID(),
  customerId = randomUUID(),
  bankId = randomUUID();
const actor = {
  id: userId,
  companyId,
  role: "ACCOUNT_USER",
  accountRole: "ACCOUNT_ADMIN",
  isActive: true,
  accountAccessActive: true,
  salesAccessActive: false,
  salesRole: null,
  managerType: null,
  branchAccessScope: "ALL_BRANCHES",
  branchIds: [branchId, otherBranch],
} as ProjectActor;
let bankLedger: string;
async function invoice(amount = "100", partyId: string = customerId) {
  const doc = await createCommercialDocumentForActor(actor, {
    type: "SALES_INVOICE",
    idempotencyKey: randomUUID(),
    branchId,
    partyId,
    issueDate: "2026-10-10",
    lines: [
      {
        lineType: "CUSTOM",
        itemName: "Cheque source invoice",
        quantity: "1",
        rate: amount,
        taxRate: "0",
      },
    ],
  });
  await postCommercialDocumentForActor(actor, { documentId: doc.id });
  return client.commercialDocument.findUniqueOrThrow({ where: { id: doc.id } });
}
async function record(documentId?: string) {
  const receipt = await createSettlementForActor(actor, {
    type: documentId ? "CUSTOMER_RECEIPT" : "CUSTOMER_ADVANCE",
    idempotencyKey: randomUUID(),
    branchId,
    partyId: customerId,
    moneyAccountId: bankId,
    paymentMode: "CHEQUE",
    chequeNumber: randomUUID().slice(0, 8),
    chequeDate: "2026-10-10",
    transactionDate: "2026-10-10",
    amount: "100",
    allocations: documentId ? [{ documentId, amount: "100" }] : [],
  });
  const cheque = await client.cheque.findFirstOrThrow({
    where: { companyId, settlementId: receipt.id },
  });
  return { receipt, cheque };
}
async function outstanding(id: string) {
  return (
    await client.$transaction((tx) =>
      documentOutstandingInTx(tx, companyId, id),
    )
  ).outstanding.toFixed(2);
}
async function bankEffect(chequeId: string) {
  const entries = await client.journalEntry.findMany({
    where: {
      companyId,
      OR: [
        {
          sourceId: {
            in: (
              await client.accountSettlement.findMany({
                where: { companyId, chequeId },
                select: { id: true },
              })
            ).map((row) => row.id),
          },
        },
        {
          reversalOf: {
            sourceId: {
              in: (
                await client.accountSettlement.findMany({
                  where: { companyId, chequeId },
                  select: { id: true },
                })
              ).map((row) => row.id),
            },
          },
        },
      ],
    },
    include: { lines: { where: { ledgerAccountId: bankLedger } } },
  });
  return entries
    .flatMap((row) => row.lines)
    .reduce((n, row) => n + Number(row.debit) - Number(row.credit), 0);
}
describe.skipIf(!url)(
  "A066 cheque ledger/settlement lifecycle on isolated PostgreSQL",
  () => {
    beforeAll(async () => {
      await client.company.create({
        data: {
          id: companyId,
          name: "Cheque finance fixture",
          slug: `cheque-${companyId}`,
          productEdition: "SALESPUNCH360_ACCOUNT",
        },
      });
      await client.accountSettings.create({
        data: { companyId, enabledModules: [] },
      });
      await client.branch.createMany({
        data: [
          {
            id: branchId,
            companyId,
            name: "Cheque branch",
            code: "A",
            isPrimary: true,
          },
          { id: otherBranch, companyId, name: "Other branch", code: "B" },
        ],
      });
      await client.user.create({
        data: {
          id: userId,
          companyId,
          name: "Cheque administrator",
          email: `${userId}@example.test`,
          passwordHash: "isolated-fixture",
          role: "ACCOUNT_USER",
          accountRole: "ACCOUNT_ADMIN",
          accountAccessActive: true,
        },
      });
      await client.customer.create({
        data: {
          id: customerId,
          companyId,
          branchId,
          name: "Cheque customer",
          isAccountCustomer: true,
        },
      });
      await client.financialYear.create({
        data: {
          companyId,
          name: "2026-27",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2027-03-31"),
        },
      });
      await client.ledgerAccount.createMany({
        data: DEFAULT_LEDGER_ACCOUNTS.map((row) => ({ ...row, companyId })),
      });
      bankLedger = (
        await client.ledgerAccount.findFirstOrThrow({
          where: { companyId, systemKey: "BANK" },
        })
      ).id;
      await client.moneyAccount.create({
        data: {
          id: bankId,
          companyId,
          branchId,
          name: "Cheque bank",
          type: "BANK",
          ledgerAccountId: bankLedger,
        },
      });
    });
    afterAll(async () => {
      if (url)
        await client.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
          await tx.cheque.updateMany({
            where: { companyId },
            data: { settlementId: null },
          });
          await tx.advanceApplication.deleteMany({ where: { companyId } });
          await tx.openingBalanceAllocation.deleteMany({
            where: { companyId },
          });
          await tx.partyOpeningBalance.deleteMany({ where: { companyId } });
          await tx.settlementAllocation.deleteMany({ where: { companyId } });
          await tx.accountSettlement.deleteMany({ where: { companyId } });
          await tx.cheque.deleteMany({ where: { companyId } });
          await tx.commercialAuditEvent.deleteMany({ where: { companyId } });
          await tx.commercialDocumentLine.deleteMany({ where: { companyId } });
          await tx.commercialDocument.deleteMany({ where: { companyId } });
          await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
          await tx.journalLine.deleteMany({ where: { companyId } });
          await tx.journalEntry.deleteMany({ where: { companyId } });
          await tx.accountOperationalAudit.deleteMany({ where: { companyId } });
          await tx.numberingSeries.deleteMany({ where: { companyId } });
          await tx.moneyAccount.deleteMany({ where: { companyId } });
          await tx.ledgerAccount.deleteMany({ where: { companyId } });
          await tx.financialYear.deleteMany({ where: { companyId } });
          await tx.customer.deleteMany({ where: { companyId } });
          await tx.user.deleteMany({ where: { companyId } });
          await tx.branch.deleteMany({ where: { companyId } });
          await tx.accountSettings.deleteMany({ where: { companyId } });
          await tx.company.deleteMany({ where: { id: companyId } });
        });
      await client.$disconnect();
    });
    it("does not relabel an unposted cheque by changing business currency", async () => {
      expect(await client.journalEntry.count({ where: { companyId } })).toBe(0);
      await record();
      await expect(saveBusinessCurrency(actor, "USD")).rejects.toThrow(
        "BUSINESS_CURRENCY_LOCKED",
      );
      expect(
        (
          await client.accountSettings.findUniqueOrThrow({
            where: { companyId },
          })
        ).baseCurrency,
      ).toBe("INR");
    });
    it("records no payment or invoice settlement until manual closure, then posts once under concurrent retries", async () => {
      const doc = await invoice();
      const original = await client.commercialDocument.findUniqueOrThrow({
        where: { id: doc.id },
      });
      const { receipt, cheque } = await record(doc.id);
      expect(receipt.status).toBe("PENDING_CHEQUE");
      expect(receipt.journalEntryId).toBeNull();
      expect(await outstanding(doc.id)).toBe("100.00");
      expect(await bankEffect(cheque.id)).toBe(0);
      const input = {
        action: "CLOSE",
        requestKey: randomUUID(),
        expectedVersion: 0,
        actionDate: "2026-10-12",
        moneyAccountId: bankId,
      };
      const closed = await Promise.all(
        Array.from({ length: 4 }, () =>
          chequeFinancialActionForActor(actor, cheque.id, input),
        ),
      );
      expect(new Set(closed.map((row) => row.journalEntryId)).size).toBe(1);
      expect(await outstanding(doc.id)).toBe("0.00");
      expect(await bankEffect(cheque.id)).toBe(100);
      await expect(
        reverseJournalForActor(actor, {
          journalEntryId: closed[0].journalEntryId,
          entryDate: "2026-10-13",
          reason: "Generic reversal bypass",
        }),
      ).rejects.toThrow("MANAGED_SETTLEMENT_REVERSAL_REQUIRED");
      expect(await outstanding(doc.id)).toBe("0.00");
      const reopened = await chequeFinancialActionForActor(actor, cheque.id, {
        action: "REOPEN",
        requestKey: randomUUID(),
        expectedVersion: 1,
        actionDate: "2026-10-13",
        reason: "Undo closure payment",
      });
      expect(reopened.status).toBe("RECEIVED");
      expect(await outstanding(doc.id)).toBe("100.00");
      expect(await bankEffect(cheque.id)).toBe(0);
      expect(
        await client.commercialDocument.findUniqueOrThrow({
          where: { id: doc.id },
        }),
      ).toEqual(original);
      // A late retry of the original closure must not re-post after reopening.
      await chequeFinancialActionForActor(actor, cheque.id, input);
      expect(await outstanding(doc.id)).toBe("100.00");
      expect(await bankEffect(cheque.id)).toBe(0);
      const reclosed = await chequeFinancialActionForActor(actor, cheque.id, {
        action: "CLOSE",
        requestKey: randomUUID(),
        expectedVersion: 2,
        actionDate: "2026-10-14",
        moneyAccountId: bankId,
      });
      expect(reclosed.status).toBe("CLEARED");
      expect(reclosed.settlementId).not.toBe(receipt.id);
      expect(await outstanding(doc.id)).toBe("0.00");
      expect(await bankEffect(cheque.id)).toBe(100);
      expect(
        (
          await client.accountSettlement.findUniqueOrThrow({
            where: { id: receipt.id },
          })
        ).status,
      ).toBe("REVERSED");
    });
    it("reverses applications of a cleared advance when reopening its cheque", async () => {
      const doc = await invoice();
      const { receipt, cheque } = await record();
      expect(receipt.remainingAmount.toFixed(2)).toBe("0.00");
      await chequeFinancialActionForActor(actor, cheque.id, {
        action: "CLOSE",
        requestKey: randomUUID(),
        expectedVersion: 0,
        actionDate: "2026-10-12",
      });
      const application = await applyAdvanceForActor(actor, {
        advanceId: receipt.id,
        documentId: doc.id,
        amount: "100",
        applicationDate: "2026-10-12",
        idempotencyKey: randomUUID(),
      });
      expect(await outstanding(doc.id)).toBe("0.00");
      await chequeFinancialActionForActor(actor, cheque.id, {
        action: "REOPEN",
        requestKey: randomUUID(),
        expectedVersion: 1,
        actionDate: "2026-10-13",
        reason: "Cheque closure correction",
      });
      expect(await outstanding(doc.id)).toBe("100.00");
      expect(await bankEffect(cheque.id)).toBe(0);
      expect(
        (
          await client.journalEntry.findUniqueOrThrow({
            where: { id: application.journalEntryId },
          })
        ).status,
      ).toBe("REVERSED");
      expect(
        (
          await client.accountSettlement.findUniqueOrThrow({
            where: { id: receipt.id },
          })
        ).status,
      ).toBe("REVERSED");
    });
    it("rejects stale versions and wrong-branch actors without posting", async () => {
      const { cheque } = await record();
      const input = {
        action: "CLOSE",
        requestKey: randomUUID(),
        expectedVersion: 0,
        actionDate: "2026-10-12",
      };
      await expect(
        chequeFinancialActionForActor(
          {
            ...actor,
            branchAccessScope: "SELECTED_BRANCHES",
            branchIds: [otherBranch],
          },
          cheque.id,
          input,
        ),
      ).rejects.toThrow();
      await expect(
        chequeFinancialActionForActor(actor, cheque.id, {
          ...input,
          expectedVersion: 1,
        }),
      ).rejects.toThrow("CHEQUE_CHANGED");
      expect(await bankEffect(cheque.id)).toBe(0);
    });
    it("preserves the full 1593.00 cheque amount and rejects changed retry content", async () => {
      const doc = await invoice("1593");
      const input = {
        branchId,
        moneyAccountId: bankId,
        partyId: customerId,
        sourceDocumentId: doc.id,
        amount: "1593.00",
        requestKey: randomUUID(),
        chequeNumber: randomUUID().slice(0, 8),
        chequeDate: "2026-10-10",
        status: "RECEIVED",
      };
      const cheque = await createChequeForActor(actor, input);
      expect((await createChequeForActor(actor, input)).id).toBe(cheque.id);
      await expect(
        createChequeForActor(actor, { ...input, amount: "1592.00" }),
      ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
      expect(await outstanding(doc.id)).toBe("1593.00");
      await chequeFinancialActionForActor(actor, cheque.id, {
        action: "CLOSE",
        requestKey: randomUUID(),
        expectedVersion: 0,
        actionDate: "2026-10-12",
      });
      expect(await outstanding(doc.id)).toBe("0.00");
      expect(await bankEffect(cheque.id)).toBe(1593);
    });
    it("completes an unposted legacy source once without settling or posting until closure", async () => {
      const doc = await invoice();
      const legacy = await client.cheque.create({
        data: {
          companyId,
          branchId,
          moneyAccountId: bankId,
          chequeNumber: randomUUID().slice(0, 8),
          chequeDate: new Date("2026-10-10"),
          partyName: "Legacy party text",
          status: "RECEIVED",
        },
      });
      const input = {
        requestKey: randomUUID(),
        expectedVersion: 0,
        partyId: customerId,
        amount: "100.00",
        sourceDocumentId: doc.id,
      };
      await expect(
        completeLegacyChequeSourceForActor(
          {
            ...actor,
            branchAccessScope: "SELECTED_BRANCHES",
            branchIds: [otherBranch],
          },
          legacy.id,
          input,
        ),
      ).rejects.toThrow();
      expect(
        (await client.cheque.findUniqueOrThrow({ where: { id: legacy.id } }))
          .amount,
      ).toBeNull();
      const completed = await completeLegacyChequeSourceForActor(
        actor,
        legacy.id,
        input,
      );
      expect(completed.actionVersion).toBe(1);
      expect(completed.amount?.toFixed(2)).toBe("100.00");
      expect(
        (await completeLegacyChequeSourceForActor(actor, legacy.id, input))
          .settlementId,
      ).toBe(completed.settlementId);
      await expect(
        completeLegacyChequeSourceForActor(actor, legacy.id, {
          ...input,
          amount: "99",
        }),
      ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
      expect(await bankEffect(legacy.id)).toBe(0);
      expect(await outstanding(doc.id)).toBe("100.00");
      await chequeFinancialActionForActor(
        { ...actor, accountRole: "ACCOUNTANT" },
        legacy.id,
        {
          action: "CLOSE",
          requestKey: randomUUID(),
          expectedVersion: 1,
          actionDate: "2026-10-12",
        },
      );
      expect(await outstanding(doc.id)).toBe("0.00");
      expect(await bankEffect(legacy.id)).toBe(100);
    });
    it("projects cash, payment discounts, credits, advances and the complete party balance separately", async () => {
      const party = await client.customer.create({
        data: {
          companyId,
          branchId,
          name: "Sale detail party",
          isAccountCustomer: true,
        },
      });
      const first = await invoice("100", party.id);
      const second = await invoice("200", party.id);
      const year = await client.financialYear.findFirstOrThrow({
        where: { companyId },
      });
      const ar = await client.ledgerAccount.findFirstOrThrow({
        where: { companyId, systemKey: "ACCOUNTS_RECEIVABLE" },
      });
      const equity = await client.ledgerAccount.findFirstOrThrow({
        where: { companyId, systemKey: "OPENING_BALANCE_EQUITY" },
      });
      const opening = await client.$transaction((tx) =>
        postJournalInTx(tx, actor, {
          financialYearId: year.id,
          branchId,
          entryDate: "2026-10-10",
          sourceType: "OPENING_BALANCE",
          sourceId: randomUUID(),
          lines: [
            { ledgerAccountId: ar.id, debit: "80", credit: "0" },
            { ledgerAccountId: equity.id, debit: "0", credit: "80" },
          ],
        }),
      );
      await client.partyOpeningBalance.create({
        data: {
          companyId,
          branchId,
          partyId: party.id,
          partyType: "CUSTOMER",
          partyName: party.name,
          effectiveDate: new Date("2026-10-10"),
          amount: "80",
          journalEntryId: opening.id,
          createdById: userId,
        },
      });
      await client.accountSettings.update({
        where: { companyId },
        data: {
          transactionDefaults: {
            transactionPreferences: { discountDuringPayment: true },
          },
        },
      });
      await createSettlementForActor(actor, {
        type: "CUSTOMER_RECEIPT",
        idempotencyKey: randomUUID(),
        branchId,
        partyId: party.id,
        paymentMode: "BANK",
        moneyAccountId: bankId,
        amount: "40.00",
        transactionDate: "2026-10-10",
        allocations: [
          { documentId: first.id, amount: "50.00", discountAmount: "10.00" },
        ],
      });
      const sourceLine = await client.commercialDocumentLine.findFirstOrThrow({
        where: { companyId, documentId: first.id },
      });
      const credit = await createCommercialDocumentForActor(actor, {
        type: "CREDIT_NOTE",
        idempotencyKey: randomUUID(),
        branchId,
        partyId: party.id,
        sourceDocumentId: first.id,
        issueDate: "2026-10-10",
        lines: [
          {
            lineType: "CUSTOM",
            itemName: "Credit adjustment",
            sourceCommercialLineId: sourceLine.id,
            quantity: "1",
            rate: "20",
            taxRate: "0",
          },
        ],
      });
      await postCommercialDocumentForActor(actor, { documentId: credit.id });
      const advance = await createSettlementForActor(actor, {
        type: "CUSTOMER_ADVANCE",
        idempotencyKey: randomUUID(),
        branchId,
        partyId: party.id,
        paymentMode: "BANK",
        moneyAccountId: bankId,
        amount: "50.00",
        transactionDate: "2026-10-10",
      });
      await applyAdvanceForActor(actor, {
        advanceId: advance.id,
        documentId: second.id,
        amount: "30.00",
        applicationDate: "2026-10-10",
        idempotencyKey: randomUUID(),
      });
      const details = await saleDetailForActor(actor, first.id);
      expect(details.paymentSummary.received).toBe("40.00");
      expect(details.paymentSummary.credits).toBe("20.00");
      expect(details.paymentSummary.paymentDiscount).toBe("10.00");
      expect(details.paymentSummary.outstanding).toBe("30.00");
      expect(details.partyBalance).toBe("260.00");
      expect(details.paymentSummary.canChange).toBe(false);
      const advanced = await saleDetailForActor(actor, second.id);
      expect(advanced.paymentSummary.received).toBe("0.00");
      expect(advanced.paymentSummary.advanceApplied).toBe("30.00");
      expect(advanced.paymentSummary.outstanding).toBe("170.00");
      expect(
        await currentPartyBalanceForActor(
          {
            ...actor,
            branchAccessScope: "SELECTED_BRANCHES",
            branchIds: [otherBranch],
          },
          party.id,
        ),
      ).toBe("0.00");
      await expect(
        saleDetailForActor(
          {
            ...actor,
            branchAccessScope: "SELECTED_BRANCHES",
            branchIds: [otherBranch],
          },
          first.id,
        ),
      ).rejects.toThrow();
    });
    it("fully offsets GST, cess, charges, round-off and withholding when correcting an unpaid sale", async () => {
      await client.branch.update({
        where: { id: branchId },
        data: { gstStateCode: "29" },
      });
      const sale = await createCommercialDocumentForActor(actor, {
        type: "SALES_INVOICE",
        idempotencyKey: randomUUID(),
        branchId,
        partyId: customerId,
        issueDate: "2026-10-10",
        stateOfSupplyCode: "29",
        freightAmount: "20",
        otherChargesAmount: "10",
        roundOffAmount: "-0.25",
        tdsRate: "1",
        tcsRate: "2",
        lines: [
          {
            lineType: "CUSTOM",
            itemName: "Full correction",
            quantity: "1",
            rate: "1000",
            taxRate: "18",
            cessRate: "5",
          },
        ],
      });
      await postCommercialDocumentForActor(actor, { documentId: sale.id });
      const before = await client.commercialDocument.findUniqueOrThrow({
        where: { id: sale.id },
      });
      const credit = await reversePostedSaleForActor(actor, sale.id);
      expect((await reversePostedSaleForActor(actor, sale.id)).id).toBe(credit.id);
      const corrected = await client.commercialDocument.findUniqueOrThrow({
        where: { id: credit.id },
      });
      expect(corrected.tdsAmount.toFixed(2)).toBe(before.tdsAmount.toFixed(2));
      expect(corrected.tcsAmount.toFixed(2)).toBe(before.tcsAmount.toFixed(2));
      expect(await outstanding(sale.id)).toBe("0.00");
      expect(
        await client.commercialDocument.findUniqueOrThrow({
          where: { id: sale.id },
        }),
      ).toEqual(before);
    });
    it("retries a committed sale amendment without creating another credit or replacement", async () => {
      const sale = await invoice("120");
      const request = {
        idempotencyKey: randomUUID(),
        branchId,
        partyId: customerId,
        issueDate: "2026-10-10",
        lines: [
          {
            lineType: "CUSTOM",
            itemName: "Amended service",
            quantity: "1",
            rate: "140",
            taxRate: "0",
          },
        ],
      };
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          replacePostedSaleForActor(actor, sale.id, request),
        ),
      );
      expect(new Set(results.map((row) => row.id)).size).toBe(1);
      expect(results.every((row) => row.status === "POSTED")).toBe(true);
      expect(
        await client.commercialDocument.count({
          where: { companyId, sourceDocumentId: sale.id, type: "CREDIT_NOTE" },
        }),
      ).toBe(1);
      await expect(
        replacePostedSaleForActor(actor, sale.id, {
          ...request,
          notes: "Changed retry intent",
        }),
      ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
      await expect(
        replacePostedSaleForActor(
          {
            ...actor,
            branchAccessScope: "SELECTED_BRANCHES",
            branchIds: [otherBranch],
          },
          sale.id,
          request,
        ),
      ).rejects.toThrow();
      expect(await outstanding(results[0].id)).toBe("140.00");
    });
  },
);
