import { salePriceProposalsForActor, confirmSalePriceForActor } from "./sale-price-updates";
import { itemPricingInput, normalizedItemPricing } from "./item-pricing";
import { itemSettingsDefaults } from "./item-settings-policy";
import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
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
import { generateAccountPaymentReminders, duePaymentReminders } from "./payment-reminder-execution";
import {saleLineNumbers,salePreviewTotals} from "./sale-preview-calculation";
import { gstReportForActor } from "./tax";
import { runFinancialReportForActor } from "./reports/service";
import { listOpeningOutstandings } from "./opening-balances";
import { saveBusinessCurrency } from "./business-currency";
import { createStockMovementForActor } from "./inventory";
import {
  reverseJournalForActor,
  postJournalInTx,
} from "@/lib/accounting/service";
import { createChequeForActor,createMoneyAccountForActor } from "./money";
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
  documentOutstandingsBatch,
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
async function invoice(amount = "100", partyId: string = customerId, dueDate?: string) {
  const doc = await createCommercialDocumentForActor(actor, {
    type: "SALES_INVOICE",
    idempotencyKey: randomUUID(),
    branchId,
    partyId,
    issueDate: "2026-10-10",
    dueDate,
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
          await tx.paymentReminder.deleteMany({where:{companyId}});
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
          await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
          await tx.projectMaterialMovement.deleteMany({where:{companyId}});
          await tx.$executeRawUnsafe("SET LOCAL session_replication_role = origin");
          await tx.stockMovement.deleteMany({where:{companyId}});
          await tx.purchaseLineAllocation.deleteMany({where:{companyId}});
          await tx.commercialDocumentLine.deleteMany({ where: { companyId } });
          await tx.inventoryBatch.deleteMany({where:{companyId}});
          await tx.inventorySerialNumber.deleteMany({where:{companyId}});
          await tx.accountProduct.deleteMany({where:{companyId}});
          await tx.accountService.deleteMany({where:{companyId}});
          await tx.warehouse.deleteMany({where:{companyId}});
          await tx.commercialDocument.deleteMany({ where: { companyId } });
        await tx.project.deleteMany({where:{companyId}});
          await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
          await tx.journalLine.deleteMany({ where: { companyId } });
          await tx.journalEntry.deleteMany({ where: { companyId } });
          await tx.accountOperationalAudit.deleteMany({ where: { companyId } });
          await tx.numberingSeries.deleteMany({ where: { companyId } });
          await tx.moneyAccount.deleteMany({ where: { companyId } });
          await tx.ledgerAccount.deleteMany({ where: { companyId } });
          await tx.financialYear.deleteMany({ where: { companyId } });
          await tx.customer.deleteMany({ where: { companyId } });
          await tx.vendor.deleteMany({where:{companyId}});
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
    it("carries vendor opening payables through payments, advances and debit notes",async()=>{
      const vendor=await client.vendor.create({data:{companyId,name:"Period ledger vendor"}});
      const year=await client.financialYear.findFirstOrThrow({where:{companyId}}),ap=await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"ACCOUNTS_PAYABLE"}}),equity=await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"OPENING_BALANCE_EQUITY"}});
      await client.$transaction(tx=>postJournalInTx(tx,actor,{financialYearId:year.id,branchId,entryDate:"2026-10-01",sourceType:"MANUAL_JOURNAL",sourceId:randomUUID(),lines:[{ledgerAccountId:bankLedger,debit:"100",credit:"0"},{ledgerAccountId:equity.id,debit:"0",credit:"100"}]}));
      const opening=await client.$transaction(tx=>postJournalInTx(tx,actor,{financialYearId:year.id,branchId,entryDate:"2026-10-01",sourceType:"OPENING_BALANCE",sourceId:randomUUID(),lines:[{ledgerAccountId:equity.id,debit:"30",credit:"0"},{ledgerAccountId:ap.id,debit:"0",credit:"30"}]}));
      await client.partyOpeningBalance.create({data:{companyId,branchId,partyId:vendor.id,partyType:"VENDOR",partyName:vendor.name,effectiveDate:new Date("2026-10-01"),amount:"30",journalEntryId:opening.id,createdById:userId}});
      const bill=await createCommercialDocumentForActor(actor,{type:"PURCHASE_BILL",purchasePurpose:"GENERAL_OFFICE",vendorInvoiceNumber:"LEDGER-BILL",vendorInvoiceDate:"2026-10-10",idempotencyKey:randomUUID(),branchId,partyId:vendor.id,issueDate:"2026-10-10",lines:[{lineType:"CUSTOM",itemName:"Vendor ledger purchase",quantity:"1",rate:"100",taxRate:"0"}]});
      await postCommercialDocumentForActor(actor,{documentId:bill.id});
      await createSettlementForActor(actor,{type:"VENDOR_PAYMENT",idempotencyKey:randomUUID(),branchId,partyId:vendor.id,paymentMode:"BANK",moneyAccountId:bankId,amount:"40",transactionDate:"2026-10-12",allocations:[{documentId:bill.id,amount:"40"}]});
      const advance=await createSettlementForActor(actor,{type:"VENDOR_ADVANCE",idempotencyKey:randomUUID(),branchId,partyId:vendor.id,paymentMode:"BANK",moneyAccountId:bankId,amount:"20",transactionDate:"2026-10-13",allocations:[]});
      await applyAdvanceForActor(actor,{advanceId:advance.id,documentId:bill.id,amount:"20",applicationDate:"2026-10-13",idempotencyKey:randomUUID()});
      const source=await client.commercialDocumentLine.findFirstOrThrow({where:{companyId,documentId:bill.id}});
      const note=await createCommercialDocumentForActor(actor,{type:"DEBIT_NOTE",purchasePurpose:"GENERAL_OFFICE",sourceDocumentId:bill.id,idempotencyKey:randomUUID(),branchId,partyId:vendor.id,issueDate:"2026-10-14",lines:[{lineType:"CUSTOM",itemName:source.itemName,sourceCommercialLineId:source.id,quantity:"0.2",rate:"100",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:note.id});
      const earlier=await runFinancialReportForActor(actor,"vendor-ledger",{vendorId:vendor.id,from:"2026-10-11",to:"2026-10-12"});expect(earlier.rows[0][5]).toBe("130.00");expect(earlier.rows.at(-1)?.[5]).toBe("90.00");
      const later=await runFinancialReportForActor(actor,"vendor-ledger",{vendorId:vendor.id,from:"2026-10-13",to:"2026-10-14"});expect(later.rows[0][5]).toBe("90.00");expect(later.rows.at(-1)?.[5]).toBe("50.00");expect(later.rows).toHaveLength(3);
    });
    it("carries party opening balances through receipts, credits, advances and dated reversal without double allocation",async()=>{
      const party=await client.customer.create({data:{companyId,branchId,name:"Period ledger party",isAccountCustomer:true}});
      const sale=await invoice("100",party.id);
      const year=await client.financialYear.findFirstOrThrow({where:{companyId}}),ar=await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"ACCOUNTS_RECEIVABLE"}}),equity=await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"OPENING_BALANCE_EQUITY"}});
      const journal=await client.$transaction(tx=>postJournalInTx(tx,actor,{financialYearId:year.id,branchId,entryDate:"2026-10-01",sourceType:"OPENING_BALANCE",sourceId:randomUUID(),lines:[{ledgerAccountId:ar.id,debit:"30",credit:"0"},{ledgerAccountId:equity.id,debit:"0",credit:"30"}]}));
      await client.partyOpeningBalance.create({data:{companyId,branchId,partyId:party.id,partyType:"CUSTOMER",partyName:party.name,effectiveDate:new Date("2026-10-01"),amount:"30",journalEntryId:journal.id,createdById:userId}});
      const receipt=await createSettlementForActor(actor,{type:"CUSTOMER_RECEIPT",idempotencyKey:randomUUID(),branchId,partyId:party.id,paymentMode:"CHEQUE",moneyAccountId:bankId,chequeNumber:randomUUID().slice(0,8),chequeDate:"2026-10-10",transactionDate:"2026-10-10",amount:"40",allocations:[{documentId:sale.id,amount:"40"}]});
      const cheque=await client.cheque.findFirstOrThrow({where:{companyId,settlementId:receipt.id}});
      await chequeFinancialActionForActor(actor,cheque.id,{action:"CLOSE",requestKey:randomUUID(),expectedVersion:0,actionDate:"2026-10-12",moneyAccountId:bankId});
      const advance=await createSettlementForActor(actor,{type:"CUSTOMER_ADVANCE",idempotencyKey:randomUUID(),branchId,partyId:party.id,paymentMode:"BANK",moneyAccountId:bankId,amount:"20",transactionDate:"2026-10-13",allocations:[]});
      await applyAdvanceForActor(actor,{advanceId:advance.id,documentId:sale.id,amount:"20",applicationDate:"2026-10-13",idempotencyKey:randomUUID()});
      const source=await client.commercialDocumentLine.findFirstOrThrow({where:{companyId,documentId:sale.id}});
      const credit=await createCommercialDocumentForActor(actor,{type:"CREDIT_NOTE",sourceDocumentId:sale.id,idempotencyKey:randomUUID(),branchId,partyId:party.id,issueDate:"2026-10-14",lines:[{lineType:"CUSTOM",itemName:source.itemName,sourceCommercialLineId:source.id,quantity:"0.2",rate:"100",taxRate:"0"}]});
      await postCommercialDocumentForActor(actor,{documentId:credit.id});
      await chequeFinancialActionForActor(actor,cheque.id,{action:"REOPEN",requestKey:randomUUID(),expectedVersion:1,actionDate:"2026-10-14",reason:"Restore earlier receipt"});
      const period=await runFinancialReportForActor(actor,"customer-ledger",{customerId:party.id,from:"2026-10-11",to:"2026-10-12"});
      expect(period.rows[0]).toMatchObject(["2026-10-11","Opening balance","","","","130.00"]);expect(period.rows.at(-1)?.[5]).toBe("90.00");
      const later=await runFinancialReportForActor(actor,"customer-ledger",{customerId:party.id,from:"2026-10-13",to:"2026-10-14"});
      expect(later.rows[0][5]).toBe("90.00");expect(later.rows.at(-1)?.[5]).toBe("90.00");expect(later.rows.some(row=>row[1]==="ADVANCE_APPLICATION")).toBe(false);expect(later.rows.filter(row=>row[1]==="REVERSAL")).toHaveLength(1);
      const empty=await runFinancialReportForActor(actor,"customer-ledger",{customerId:party.id,from:"2026-10-15",to:"2026-10-15"});expect(empty.rows).toHaveLength(1);expect(empty.rows[0][5]).toBe("90.00");
      const denied=await runFinancialReportForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},"customer-ledger",{customerId:party.id,from:"2026-10-01",to:"2026-10-14"});expect(denied.rows).toHaveLength(1);expect(denied.rows[0][5]).toBe("0.00");
    });
    it("keeps historical aging payments and advance applications effective until their dated reversal",async()=>{
      for(const advanced of [false,true]){
        const sale=await invoice();
        const {receipt,cheque}=await record(advanced?undefined:sale.id);
        await chequeFinancialActionForActor(actor,cheque.id,{action:"CLOSE",requestKey:randomUUID(),expectedVersion:0,actionDate:"2026-10-12",moneyAccountId:bankId});
        if(advanced)await applyAdvanceForActor(actor,{advanceId:receipt.id,documentId:sale.id,amount:"40",applicationDate:"2026-10-13",idempotencyKey:randomUUID()});
        await chequeFinancialActionForActor(actor,cheque.id,{action:"REOPEN",requestKey:randomUUID(),expectedVersion:1,actionDate:"2026-10-14",reason:"Reverse later closure"});
        for(const [day,expected] of [["2026-10-11","100.00"],["2026-10-12",advanced?"100.00":"0.00"],["2026-10-13",advanced?"60.00":"0.00"],["2026-10-14","100.00"]]){
          const values=await documentOutstandingsBatch(companyId,[sale],new Date(day));
          expect(values.get(sale.id)?.toFixed(2)).toBe(expected);
        }
        expect((await documentOutstandingsBatch(companyId,[sale])).get(sale.id)?.toFixed(2)).toBe("100.00");
      }
    });
    it("uses the cutoff for opening-balance payments and later cheque reopening",async()=>{
      const party=await client.customer.create({data:{companyId,branchId,name:"Historical opening party",isAccountCustomer:true}});
      const year=await client.financialYear.findFirstOrThrow({where:{companyId}}),ar=await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"ACCOUNTS_RECEIVABLE"}}),equity=await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"OPENING_BALANCE_EQUITY"}});
      const journal=await client.$transaction(tx=>postJournalInTx(tx,actor,{financialYearId:year.id,branchId,entryDate:"2026-10-01",sourceType:"OPENING_BALANCE",sourceId:randomUUID(),lines:[{ledgerAccountId:ar.id,debit:"80",credit:"0"},{ledgerAccountId:equity.id,debit:"0",credit:"80"}]}));
      const opening=await client.partyOpeningBalance.create({data:{companyId,branchId,partyId:party.id,partyType:"CUSTOMER",partyName:party.name,effectiveDate:new Date("2026-10-01"),amount:"80",journalEntryId:journal.id,createdById:userId}});
      const receipt=await createSettlementForActor(actor,{type:"CUSTOMER_RECEIPT",idempotencyKey:randomUUID(),branchId,partyId:party.id,paymentMode:"CHEQUE",moneyAccountId:bankId,chequeNumber:randomUUID().slice(0,8),chequeDate:"2026-10-10",transactionDate:"2026-10-10",amount:"80",allocations:[{openingBalanceId:opening.id,amount:"80"}]});
      const cheque=await client.cheque.findFirstOrThrow({where:{companyId,settlementId:receipt.id}});
      await chequeFinancialActionForActor(actor,cheque.id,{action:"CLOSE",requestKey:randomUUID(),expectedVersion:0,actionDate:"2026-10-12",moneyAccountId:bankId});
      await chequeFinancialActionForActor(actor,cheque.id,{action:"REOPEN",requestKey:randomUUID(),expectedVersion:1,actionDate:"2026-10-14",reason:"Restore unpaid opening"});
      for(const [day,expected] of [["2026-10-11","80.00"],["2026-10-12","0.00"],["2026-10-13","0.00"],["2026-10-14","80.00"]]){
        const rows=await listOpeningOutstandings({companyId,partyType:"CUSTOMER",partyId:party.id,branchIds:[branchId],asOf:new Date(day)});
        expect(rows.find(row=>row.id===opening.id)?.outstanding.toFixed(2)??"0.00").toBe(expected);
      }
    });
    it("excludes future credit notes from a historical aging cutoff",async()=>{
      const sale=await invoice();
      const source=await client.commercialDocumentLine.findFirstOrThrow({where:{companyId,documentId:sale.id}});
      const credit=await createCommercialDocumentForActor(actor,{type:"CREDIT_NOTE",sourceDocumentId:sale.id,idempotencyKey:randomUUID(),branchId,partyId:customerId,issueDate:"2026-10-14",lines:[{lineType:"CUSTOM",itemName:source.itemName,sourceCommercialLineId:source.id,quantity:"0.2",rate:"100",taxRate:"0"}]});
      await postCommercialDocumentForActor(actor,{documentId:credit.id});
      expect((await documentOutstandingsBatch(companyId,[sale],new Date("2026-10-13"))).get(sale.id)?.toFixed(2)).toBe("100.00");
      expect((await documentOutstandingsBatch(companyId,[sale],new Date("2026-10-14"))).get(sale.id)?.toFixed(2)).toBe("80.00");
      const report=await runFinancialReportForActor(actor,"receivable-aging",{to:"2026-10-13"});
      expect(report.rows.find(row=>row[0]===sale.documentNumber)?.[3]).toBe("100");
    });
    it("matches advertised Accountant correction authority for linked and advance cheques and rolls back denied actors",async()=>{
      const accountant={...actor,accountRole:"ACCOUNTANT" as const};
      for(const linked of [true,false]){
        const sale=linked?await invoice():null;
        const {cheque}=await record(sale?.id);
        const closed=await chequeFinancialActionForActor(accountant,cheque.id,{action:"CLOSE",requestKey:randomUUID(),expectedVersion:0,actionDate:"2026-10-12",moneyAccountId:bankId});
        const count=await client.journalEntry.count({where:{companyId}});
        await expect(chequeFinancialActionForActor({...actor,accountRole:"DATA_ENTRY"},cheque.id,{action:"BOUNCE",requestKey:randomUUID(),expectedVersion:closed.actionVersion,actionDate:"2026-10-13",reason:"Bank returned cheque"})).rejects.toThrow();
        expect(await client.journalEntry.count({where:{companyId}})).toBe(count);
        expect((await client.cheque.findUniqueOrThrow({where:{id:cheque.id}})).status).toBe(closed.status);
        const bounced=await chequeFinancialActionForActor(accountant,cheque.id,{action:"BOUNCE",requestKey:randomUUID(),expectedVersion:closed.actionVersion,actionDate:"2026-10-13",reason:"Bank returned cheque"});
        expect(bounced.status).toBe("BOUNCED");expect(await bankEffect(cheque.id)).toBe(0);
        if(sale)expect(await outstanding(sale.id)).toBe("100.00");
      }
    });
    it("serializes a concurrent payment and sale amendment without duplicate economic sale or payment",async()=>{
      const sale=await invoice("100");
      const results=await Promise.allSettled([
        replacePostedSaleForActor(actor,sale.id,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:customerId,issueDate:"2026-10-12",lines:[{lineType:"CUSTOM",itemName:"Replacement",quantity:"1",rate:"125",taxRate:"0"}]}),
        createSettlementForActor(actor,{type:"CUSTOMER_RECEIPT",idempotencyKey:randomUUID(),branchId,partyId:customerId,paymentMode:"BANK",moneyAccountId:bankId,amount:"100",transactionDate:"2026-10-12",allocations:[{documentId:sale.id,amount:"100"}]}),
      ]);
      expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
      if(results[0].status==="fulfilled"){
        expect(await outstanding(sale.id)).toBe("0.00");
        expect(await outstanding(results[0].value.id)).toBe("125.00");
        expect(await client.settlementAllocation.count({where:{companyId,documentId:sale.id}})).toBe(0);
      }else{
        expect(results[1].status).toBe("fulfilled");
        expect(await outstanding(sale.id)).toBe("0.00");
        expect(await client.commercialDocument.count({where:{companyId,sourceDocumentId:sale.id,type:"CREDIT_NOTE"}})).toBe(0);
        expect(await client.settlementAllocation.count({where:{companyId,documentId:sale.id}})).toBe(1);
      }
    });
    it("returns the exact batch/serial stock and cost once on full sale reversal",async()=>{
      await client.accountSettings.update({where:{companyId},data:{enabledModules:["INVENTORY"]}});
      try{
        const warehouse=await client.warehouse.create({data:{companyId,branchId,name:"Sale reversal stock",code:"REVERSAL"}});
        const product=await client.accountProduct.create({data:{companyId,name:"Serial reversal item",trackInventory:true,trackingMode:"SERIAL",costPrice:"40"}});
        const batch=await client.inventoryBatch.create({data:{companyId,productId:product.id,batchNumber:"REV-BATCH"}});
        const serial=await client.inventorySerialNumber.create({data:{companyId,productId:product.id,serialNumber:"REV-SERIAL"}});
        await createStockMovementForActor(actor,"OPENING",{warehouseId:warehouse.id,productId:product.id,quantity:"1",unitCost:"40",batchId:batch.id,serialNumberId:serial.id,movementDate:"2026-10-10",sourceType:"OPENING",sourceId:randomUUID()});
        const sale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:customerId,issueDate:"2026-10-10",lines:[{lineType:"PRODUCT",sourceId:product.id,quantity:"1",rate:"100",taxRate:"0",warehouseId:warehouse.id,batchId:batch.id,serialNumberId:serial.id}]});
        await postCommercialDocumentForActor(actor,{documentId:sale.id});
        const before=await client.commercialDocument.findUniqueOrThrow({where:{id:sale.id}});
        const credit=await reversePostedSaleForActor(actor,sale.id);
        expect((await reversePostedSaleForActor(actor,sale.id)).id).toBe(credit.id);
        const movements=await client.stockMovement.findMany({where:{companyId,productId:product.id,sourceId:{in:[sale.id,credit.id]}}});
        expect(movements).toHaveLength(2);expect(movements.every(row=>row.batchId===batch.id&&row.serialNumberId===serial.id&&row.unitCost.toFixed(2)==="40.00")).toBe(true);
        expect(movements.find(row=>row.movementType==="SALE")?.quantity.toFixed(4)).toBe("1.0000");
        expect(movements.find(row=>row.movementType==="SALES_RETURN")?.quantity.toFixed(4)).toBe("1.0000");
        expect(await outstanding(sale.id)).toBe("0.00");
        expect(await client.commercialDocument.findUniqueOrThrow({where:{id:sale.id}})).toEqual(before);
      }finally{await client.accountSettings.update({where:{companyId},data:{enabledModules:[]}})}
    });
    it("isolates dormant material cost reports by Project assignment and branch",async()=>{
      await client.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS","PROJECT_COSTING"]}});
      try{
        const projects=await Promise.all([true,false].map(assigned=>client.project.create({data:{companyId,branchId,customerId,projectNumber:randomUUID(),name:assigned?"Assigned material project":"Unassigned material project",createdById:userId,projectManagerId:assigned?userId:null}})));
        const product=await client.accountProduct.create({data:{companyId,name:"Scoped report material",trackInventory:false}});
        for(const project of projects)await client.projectMaterialMovement.create({data:{companyId,branchId,projectId:project.id,productId:product.id,movementType:"CONSUMPTION",quantity:"1",originalUnitCost:"40",totalCost:"40",movementDate:new Date("2026-10-10"),createdById:userId,idempotencyKey:randomUUID()}});
        const manager={...actor,accountRole:"PROJECT_MANAGER"} as ProjectActor;
        const result=await runFinancialReportForActor(manager,"material-consumption",{from:"2026-10-10",to:"2026-10-10"});
        expect(result.rows).toHaveLength(1);expect(result.rows[0][1]).toBe(projects[0].id);expect(result.rows[0][5]).toBe("40");
        await expect(runFinancialReportForActor(manager,"material-consumption",{projectId:projects[1].id})).rejects.toThrow();
        await expect(runFinancialReportForActor({...actor,accountRole:"ACCOUNTANT"} as ProjectActor,"material-consumption",{})).rejects.toThrow();
        expect((await runFinancialReportForActor({...manager,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},"material-consumption",{})).rows).toEqual([]);
        await client.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS"]}});
        await expect(runFinancialReportForActor(manager,"material-consumption",{})).rejects.toThrow();
      }finally{await client.accountSettings.update({where:{companyId},data:{enabledModules:[]}})}
    });
    it("applies profitability filters and preserves compatible unit quantities through credits",async()=>{
      await client.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS","INVENTORY"]}});
      try{
        const party=await client.customer.create({data:{companyId,branchId,name:"Profit filter customer",isAccountCustomer:true}});
        const project=await client.project.create({data:{companyId,branchId,customerId:party.id,projectNumber:randomUUID(),name:"Profit filter project",createdById:actor.id}});
        const products=await Promise.all(["Selected product","Other product"].map(name=>client.accountProduct.create({data:{companyId,name,trackInventory:false}})));
        const sale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:party.id,projectId:project.id,issueDate:"2026-10-10",lines:products.map((product,index)=>({lineType:"PRODUCT",sourceId:product.id,quantity:"1",rate:index?"70":"30",taxRate:"0",unitName:index?"Kilogram":"Number",unitSymbol:index?"kg":"Nos"}))});
        await postCommercialDocumentForActor(actor,{documentId:sale.id});
        for(const name of ["items","invoices","customers"]){
          const filter={scope:"all",from:"2026-10-10",to:"2026-10-10",customerId:party.id,projectId:project.id,productId:products[0].id};
          const result=await runFinancialReportForActor(actor,name,filter);
          expect(result.rows).toHaveLength(1);expect(result.rows[0][2]).toBe("30");expect(result.rows[0][1]).toBe("1.0000 Nos");
          for(const key of ["customerId","projectId","productId"]){
            expect((await runFinancialReportForActor(actor,name,{...filter,[key]:randomUUID()})).rows).toEqual([]);
          }
          expect((await runFinancialReportForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},name,filter)).rows).toEqual([]);
        }
        const mixed=await runFinancialReportForActor(actor,"customers",{scope:"all",from:"2026-10-10",to:"2026-10-10",customerId:party.id});
        expect(mixed.rows[0][1]).toBe("Mixed units");
        await reversePostedSaleForActor(actor,sale.id);
        const corrected=await runFinancialReportForActor(actor,"customers",{scope:"all",from:"2026-10-10",to:"2026-10-31",customerId:party.id,projectId:project.id,productId:products[0].id});
        expect(corrected.rows).toHaveLength(1);expect(corrected.rows[0][2]).toBe("0");expect(corrected.rows[0][1]).toBe("0.0000 Nos");
      }finally{await client.accountSettings.update({where:{companyId},data:{enabledModules:[]}})}
    });
    it("preserves cancelled sale history in profit and GST across correction periods",async()=>{
      await client.accountSettings.update({where:{companyId},data:{enabledModules:["GST_ADVANCED"]}});
      try{
        const party=await client.customer.create({data:{companyId,branchId,name:"Historical correction reports",isAccountCustomer:true}});
        const sale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:party.id,issueDate:"2026-10-10",lines:[{lineType:"CUSTOM",itemName:"Historical report service",quantity:"1",rate:"100",taxRate:"18"}]});
        await postCommercialDocumentForActor(actor,{documentId:sale.id});
        const credit=await reversePostedSaleForActor(actor,sale.id);
        // Rehearse historical lifecycle data: older correction code marked the source CANCELLED.
        // Only this isolated fixture tenant bypasses immutability; production writes remain guarded.
        await client.$transaction(async tx=>{
          await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
          await tx.commercialDocument.update({where:{id:sale.id},data:{status:"CANCELLED"}});
          await tx.commercialDocument.update({where:{id:credit.id},data:{issueDate:new Date("2026-10-14")}});
          await tx.journalEntry.update({where:{id:credit.journalEntryId!},data:{entryDate:new Date("2026-10-14")}});
          await tx.$executeRawUnsafe("SET LOCAL session_replication_role = origin");
        });
        for(const to of ["2026-10-13","2026-10-14"]){
          for(const report of ["items","invoices","customers"]){
            const result=await runFinancialReportForActor(actor,report,{scope:"all",from:"2026-10-10",to});
            const label=report==="items"?"Historical report service":report==="customers"?party.name:sale.documentNumber;
            const rows=result.rows.filter(row=>row[0]===label||report==="invoices"&&row[0]===credit.documentNumber);
            expect(rows.reduce((sum,row)=>sum+Number(row[2]),0)).toBe(to==="2026-10-13"?100:0);
          }
          const gst=await gstReportForActor(actor,{from:"2026-10-10",to,branchId});
          const rows=gst.rows.filter(row=>row.id===sale.id||row.id===credit.id);
          expect(rows.reduce((sum,row)=>sum+Number(row.taxable),0)).toBe(to==="2026-10-13"?100:0);
          expect(rows.reduce((sum,row)=>sum+Number(row.cgst)+Number(row.sgst)+Number(row.igst),0)).toBe(to==="2026-10-13"?18:0);
        }
        const later=await runFinancialReportForActor(actor,"customers",{scope:"all",from:"2026-10-14",to:"2026-10-14"});
        expect(later.rows.find(row=>row[0]===party.name)?.[2]).toBe("-100");
      }finally{await client.accountSettings.update({where:{companyId},data:{enabledModules:[]}})}
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
      expect((await reversePostedSaleForActor(actor, sale.id)).id).toBe(
        credit.id,
      );
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
    it("retains only verified source-line snapshots and rejects foreign or duplicate lines", async () => {
      const draft = await createCommercialDocumentForActor(actor, {
        type: "SALES_INVOICE",
        branchId,
        partyId: customerId,
        issueDate: "2026-10-10",
        lines: [
          {
            lineType: "CUSTOM",
            itemName: "Original service",
            itemCode: "SAVED-1",
            description: "Original description",
            specification: "Original specification",
            unitName: "Saved unit",
            unitSymbol: "Su",
            quantity: "1",
            rate: "100",
            taxRate: "0",
          },
        ],
      });
      await postCommercialDocumentForActor(actor, { documentId: draft.id });
      const source = await client.commercialDocumentLine.findFirstOrThrow({
        where: { documentId: draft.id },
      });
      const line = {
        originalLineId: source.id,
        lineType: "CUSTOM",
        quantity: "2",
        rate: "100",
      };
      const input = {
        branchId,
        partyId: customerId,
        issueDate: "2026-10-10",
        lines: [line],
      };
      await expect(
        replacePostedSaleForActor(actor, draft.id, {
          ...input,
          idempotencyKey: randomUUID(),
          lines: [{ ...line, originalLineId: randomUUID() }],
        }),
      ).rejects.toThrow("INVALID_SALE_LINE_SOURCE");
      await expect(
        replacePostedSaleForActor(actor, draft.id, {
          ...input,
          idempotencyKey: randomUUID(),
          lines: [line, line],
        }),
      ).rejects.toThrow("INVALID_SALE_LINE_SOURCE");
      expect(
        await client.commercialDocument.count({
          where: { sourceDocumentId: draft.id, type: "CREDIT_NOTE" },
        }),
      ).toBe(0);
      const replacement = await replacePostedSaleForActor(actor, draft.id, {
        ...input,
        idempotencyKey: randomUUID(),
      });
      const saved = await client.commercialDocumentLine.findFirstOrThrow({
        where: { documentId: replacement.id },
      });
      expect(saved).toMatchObject({
        itemName: "Original service",
        itemCode: "SAVED-1",
        description: "Original description",
        specification: "Original specification",
        unitName: "Saved unit",
        unitSymbol: "Su",
      });
      expect(saved.quantity.toString()).toBe("2");
      expect(
        await client.commercialDocumentLine.findUniqueOrThrow({
          where: { id: source.id },
        }),
      ).toEqual(source);
    });
    it("A086 Decimal previews match stored inclusive/exclusive fractional discounted GST and cess",async()=>{
      const line={lineType:"CUSTOM",itemName:"Rounding boundary",quantity:"3",rate:"0.335",taxRate:"18",cessRate:"2",discountType:"PERCENTAGE",discountValue:"33.335"};
      for(const taxMode of ["INCLUSIVE","EXCLUSIVE"] as const)for(const row of [line,{...line,quantity:"1",rate:"0.03",cessRate:"0",discountValue:"0"}]){
        const doc=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:customerId,issueDate:"2026-10-10",taxMode,lines:[row]});
        const stored=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:doc.id}}),preview=saleLineNumbers(row,taxMode==="INCLUSIVE"?"WITH":"WITHOUT");
        expect(stored.baseAmount.toFixed(2)).toBe(preview.base.toFixed(2));expect(stored.discountAmount.toFixed(2)).toBe(preview.disc.toFixed(2));expect(stored.taxableAmount.toFixed(2)).toBe(preview.taxable.toFixed(2));expect(stored.taxAmount.toFixed(2)).toBe(preview.tax.toFixed(2));expect(stored.cessAmount?.toFixed(2)).toBe(preview.cessTax.toFixed(2));expect(stored.lineTotal.toFixed(2)).toBe(preview.total.toFixed(2));
        await postCommercialDocumentForActor(actor,{documentId:doc.id});
        const saved=await client.commercialDocument.findUniqueOrThrow({where:{id:doc.id}});expect(saved.grandTotal.toFixed(2)).toBe(salePreviewTotals([row],taxMode==="INCLUSIVE"?"WITH":"WITHOUT").total.toFixed(2));expect(saved.journalEntryId).not.toBeNull();
      }
    });
    it("A100 scheduled sweeps deduplicate, scope and suppress settled manual reminders", async () => {
      const due = await invoice("100", customerId, "2026-10-10");
      const future = await invoice("50", customerId, "2026-10-20");
      const now = new Date("2026-10-12T06:00:00Z");
      const defaults = {
        reminderSettings: {
          payment: {
            enabled: true,
            overdueDays: 1,
            frequency: "TWICE_DAILY",
            message: "Hi {party}, pay {amount} for {document}.",
          },
        },
      };
      await client.accountSettings.update({
        where: { companyId },
        data: { transactionDefaults: defaults },
      });
      try {
        await Promise.all([
          generateAccountPaymentReminders(now),
          generateAccountPaymentReminders(now),
        ]);
        expect(
          await client.paymentReminder.count({
            where: { companyId, documentId: due.id },
          }),
        ).toBe(1);
        expect(
          await client.paymentReminder.count({
            where: { companyId, documentId: future.id },
          }),
        ).toBe(0);
        const visible = await duePaymentReminders(
          {
            ...actor,
            branchAccessScope: "SELECTED_BRANCHES",
            branchIds: [branchId],
          },
          now,
        );
        expect(
          visible.find((row) => row.documentId === due.id)?.message,
        ).toContain("₹100.00");
        expect(
          await duePaymentReminders(
            {
              ...actor,
              branchAccessScope: "SELECTED_BRANCHES",
              branchIds: [otherBranch],
            },
            now,
          ),
        ).toEqual([]);
        expect(
          await duePaymentReminders(
            { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
            now,
          ),
        ).toEqual([]);
        expect(
          await duePaymentReminders({ ...actor, companyId: randomUUID() }, now),
        ).toEqual([]);
        const queued = await client.paymentReminder.findFirstOrThrow({
          where: { companyId, documentId: due.id },
        });
        expect(queued.status).toBe("PENDING");
        await createSettlementForActor(actor, {
          type: "CUSTOMER_RECEIPT",
          idempotencyKey: randomUUID(),
          branchId,
          partyId: customerId,
          moneyAccountId: bankId,
          paymentMode: "BANK",
          transactionDate: "2026-10-12",
          amount: "100",
          allocations: [{ documentId: due.id, amount: "100" }],
        });
        expect(
          (await duePaymentReminders(actor, now)).some(
            (row) => row.documentId === due.id,
          ),
        ).toBe(false);
        await generateAccountPaymentReminders(new Date("2026-10-12T12:00:00Z"));
        expect(
          await client.paymentReminder.count({
            where: { companyId, documentId: due.id },
          }),
        ).toBe(1);
        expect(
          (
            await client.paymentReminder.findUniqueOrThrow({
              where: { id: queued.id },
            })
          ).status,
        ).toBe("PENDING");
      } finally {
        await client.paymentReminder.deleteMany({ where: { companyId } });
        await client.accountSettings.update({
          where: { companyId },
          data: { transactionDefaults: {} },
        });
      }
    });
    it("A058 normalized catalogue prices retain invoice tax and discount parity",async()=>{
      const product=await client.accountProduct.create({data:{companyId,name:"Normalized inclusive pricing",salePrice:"100",costPrice:"50",taxRate:"18",pricing:{saleTaxMode:"INCLUSIVE",purchaseTaxMode:"INCLUSIVE",enteredSalePrice:"118.00",enteredPurchasePrice:"59.00",discountType:"PERCENTAGE",discountValue:"10",normalizedDiscountValue:"10"}}});
      for(const discountType of ["PERCENTAGE","FIXED"] as const)for(const taxMode of ["INCLUSIVE","EXCLUSIVE"] as const){
        await client.accountProduct.update({where:{id:product.id},data:{pricing:{saleTaxMode:"EXCLUSIVE",enteredSalePrice:"100.00",discountType,discountValue:"10",normalizedDiscountValue:"10"}}});
        const doc=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:customerId,issueDate:"2026-10-10",taxMode,lines:[{lineType:"PRODUCT",sourceId:product.id,quantity:"3"}]});
        const line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:doc.id}});
        expect(line.rate.toFixed(2)).toBe(taxMode==="INCLUSIVE"?"118.00":"100.00");expect(line.discountType).toBe(discountType);expect(line.taxableAmount.toFixed(2)).toBe("270.00");expect(doc.grandTotal.toFixed(2)).toBe("318.60");
        await postCommercialDocumentForActor(actor,{documentId:doc.id});
        const saved=await client.commercialDocument.findUniqueOrThrow({where:{id:doc.id}});
        const journal=await client.journalEntry.findUniqueOrThrow({where:{id:saved.journalEntryId!},include:{lines:true}});
        expect(journal.lines.reduce((n,line)=>n+Number(line.debit),0).toFixed(2)).toBe(journal.lines.reduce((n,line)=>n+Number(line.credit),0).toFixed(2));
      }
    });
    it("A057 confirmed master updates are scoped idempotent and do not mutate posted financial history",async()=>{
      const previous=(await client.accountSettings.findUniqueOrThrow({where:{companyId}})).itemSettings;
      const product=await client.accountProduct.create({data:{companyId,name:"Confirmed retail price",salePrice:"100",costPrice:"50",taxRate:"18",pricing:{saleTaxMode:"INCLUSIVE",purchaseTaxMode:"EXCLUSIVE",enteredSalePrice:"118.00",enteredPurchasePrice:"50.00",discountType:"PERCENTAGE",discountValue:"0",mrp:"236",normalizedMrp:"200.00",mrpTaxMode:"INCLUSIVE"}}});
      const doc=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:customerId,issueDate:"2026-10-10",taxMode:"INCLUSIVE",lines:[{lineType:"PRODUCT",sourceId:product.id,quantity:"1",rate:"141.60"}]});await postCommercialDocumentForActor(actor,{documentId:doc.id});
      try{
        expect(await salePriceProposalsForActor(actor,doc.id)).toEqual([]);
        await client.accountSettings.update({where:{companyId},data:{itemSettings:{...previous as object,updateSalePrice:true}}});
        const proposals=await salePriceProposalsForActor(actor,doc.id);expect(proposals).toHaveLength(1);expect(proposals[0]).toMatchObject({oldPrice:"100",newPrice:"120"});
        const journals=await client.journalEntry.count({where:{companyId}}),posted=await client.commercialDocument.findUniqueOrThrow({where:{id:doc.id}});
        const request={documentId:doc.id,lineId:proposals[0].lineId,expectedUpdatedAt:proposals[0].expectedUpdatedAt,requestKey:randomUUID(),confirmed:true};
        await expect(confirmSalePriceForActor(actor,{...request,confirmed:false})).rejects.toThrow();
        await expect(confirmSalePriceForActor({...actor,accountRole:"DATA_ENTRY"},request)).rejects.toThrow();
        await expect(confirmSalePriceForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[otherBranch]},request)).rejects.toThrow();
        await Promise.all([confirmSalePriceForActor(actor,request),confirmSalePriceForActor(actor,request)]);
        const updated=await client.accountProduct.findUniqueOrThrow({where:{id:product.id}});expect(updated.salePrice?.toString()).toBe("120");expect(updated.costPrice?.toString()).toBe("50");expect(updated.pricing).toMatchObject({mrp:"236",enteredSalePrice:"141.60"});
        expect(await client.accountOperationalAudit.count({where:{companyId,eventType:"SALE_MASTER_PRICE_CONFIRMED",entityId:product.id}})).toBe(1);
        await confirmSalePriceForActor(actor,request);expect((await client.accountProduct.findUniqueOrThrow({where:{id:product.id}})).updatedAt).toEqual(updated.updatedAt);
        await expect(confirmSalePriceForActor(actor,{...request,lineId:randomUUID()})).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
        expect(await client.journalEntry.count({where:{companyId}})).toBe(journals);expect(await client.commercialDocument.findUniqueOrThrow({where:{id:doc.id}})).toEqual(posted);
        expect(await salePriceProposalsForActor(actor,doc.id)).toEqual([]);
      }finally{await client.accountSettings.update({where:{companyId},data:{itemSettings:previous??{}}});}
    });
    it("A057 stale master versions and disabled price updates cannot overwrite current prices",async()=>{
      const previous=(await client.accountSettings.findUniqueOrThrow({where:{companyId}})).itemSettings;
      const service=await client.accountService.create({data:{companyId,name:"Confirmed service price",sellingRate:"100",estimatedCost:"50",taxRate:"18"}});
      const doc=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:customerId,issueDate:"2026-10-10",lines:[{lineType:"SERVICE",sourceId:service.id,quantity:"1",rate:"120"}]});await postCommercialDocumentForActor(actor,{documentId:doc.id});
      try{
       await client.accountSettings.update({where:{companyId},data:{itemSettings:{...previous as object,updateSalePrice:true}}});
       const p=(await salePriceProposalsForActor(actor,doc.id))[0],request={documentId:doc.id,lineId:p.lineId,expectedUpdatedAt:p.expectedUpdatedAt,requestKey:randomUUID(),confirmed:true};
       await client.accountService.update({where:{id:service.id},data:{sellingRate:"130",updatedAt:new Date(Date.now()+1000)}});
       await expect(confirmSalePriceForActor(actor,request)).rejects.toThrow("SALE_PRICE_CHANGED");expect((await client.accountService.findUniqueOrThrow({where:{id:service.id}})).sellingRate?.toString()).toBe("130");
       await client.accountSettings.update({where:{companyId},data:{itemSettings:{...previous as object,updateSalePrice:false}}});
       await expect(confirmSalePriceForActor(actor,request)).rejects.toThrow("SALE_PRICE_UPDATE_DISABLED");expect(await salePriceProposalsForActor(actor,doc.id)).toEqual([]);
       const foreign=await client.company.create({data:{name:"Foreign price tenant",slug:`price-${randomUUID()}`,productEdition:"SALESPUNCH360_ACCOUNT"}});try{await expect(salePriceProposalsForActor({...actor,companyId:foreign.id},doc.id)).rejects.toThrow();}finally{await client.company.delete({where:{id:foreign.id}});}
      }finally{await client.accountSettings.update({where:{companyId},data:{itemSettings:previous??{}}});}
    });
    it("A057 a failed price audit rolls back the master change without touching invoice posting",async()=>{
      const previous=(await client.accountSettings.findUniqueOrThrow({where:{companyId}})).itemSettings;
      const product=await client.accountProduct.create({data:{companyId,name:"Audit rollback retail price",salePrice:"100",taxRate:"0"}});
      const doc=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:customerId,issueDate:"2026-10-10",lines:[{lineType:"PRODUCT",sourceId:product.id,quantity:"1",rate:"120",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:doc.id});
      const fn=`price_fail_${randomUUID().replaceAll("-","")}`;let installed=false;
      try{
       await client.accountSettings.update({where:{companyId},data:{itemSettings:{...previous as object,updateSalePrice:true}}});
       const p=(await salePriceProposalsForActor(actor,doc.id))[0],before=await client.accountProduct.findUniqueOrThrow({where:{id:product.id}}),journals=await client.journalEntry.count({where:{companyId}});
       await client.$executeRawUnsafe(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId"='${companyId}'::uuid AND NEW."eventType"='SALE_MASTER_PRICE_CONFIRMED' THEN RAISE EXCEPTION 'price audit failure'; END IF; RETURN NEW; END $$`);
       await client.$executeRawUnsafe(`CREATE TRIGGER ${fn} BEFORE INSERT ON account_operational_audits FOR EACH ROW EXECUTE FUNCTION ${fn}()`);installed=true;
       await expect(confirmSalePriceForActor(actor,{documentId:doc.id,lineId:p.lineId,expectedUpdatedAt:p.expectedUpdatedAt,requestKey:randomUUID(),confirmed:true})).rejects.toThrow();
       expect(await client.accountProduct.findUniqueOrThrow({where:{id:product.id}})).toEqual(before);expect(await client.journalEntry.count({where:{companyId}})).toBe(journals);expect(await client.accountOperationalAudit.count({where:{companyId,eventType:"SALE_MASTER_PRICE_CONFIRMED",entityId:product.id}})).toBe(0);
      }finally{if(installed)await client.$executeRawUnsafe(`DROP TRIGGER ${fn} ON account_operational_audits`);await client.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`);await client.accountSettings.update({where:{companyId},data:{itemSettings:previous??{}}});}
    });
    it("A057 tax-inclusive MRP never overrides actual selling-price tax or balanced posting",async()=>{
      const price=normalizedItemPricing({sellingRate:"90",cost:"50",taxRate:"18",pricing:itemPricingInput.parse({mrp:"118"})},{...itemSettingsDefaults,taxOnMrp:true});
      const product=await client.accountProduct.create({data:{companyId,name:"MRP distinct from sale",salePrice:price.saleRate,costPrice:price.costRate,taxRate:"18",pricing:price.pricing}});
      const doc=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:customerId,issueDate:"2026-10-10",taxMode:"EXCLUSIVE",lines:[{lineType:"PRODUCT",sourceId:product.id,quantity:"1"}]});
      const line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:doc.id}});expect(line.taxableAmount.toFixed(2)).toBe("90.00");expect(doc.grandTotal.toFixed(2)).toBe("106.20");
      await postCommercialDocumentForActor(actor,{documentId:doc.id});
      const saved=await client.commercialDocument.findUniqueOrThrow({where:{id:doc.id}}),journal=await client.journalEntry.findUniqueOrThrow({where:{id:saved.journalEntryId!},include:{lines:true}});
      expect(journal.lines.reduce((sum,row)=>sum.add(row.debit),new Prisma.Decimal(0)).toFixed(2)).toBe("106.20");expect(journal.lines.reduce((sum,row)=>sum.add(row.credit),new Prisma.Decimal(0)).toFixed(2)).toBe("106.20");
    });
    it("A084 sale reports net returns once and retain recognized invoice balances and scope",async()=>{
      const party=await client.customer.create({data:{companyId,branchId,name:"Report-only customer",isAccountCustomer:true}});
      const sale=await invoice("100",party.id);
      const line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:sale.id}});
      const credit=await createCommercialDocumentForActor(actor,{type:"CREDIT_NOTE",branchId,partyId:party.id,sourceDocumentId:sale.id,issueDate:"2026-10-11",idempotencyKey:randomUUID(),lines:[{lineType:"CUSTOM",itemName:line.itemName,quantity:"0.5",rate:"100",taxRate:"0",sourceCommercialLineId:line.id,stockReturnQuantity:"0.5"}]});
      await postCommercialDocumentForActor(actor,{documentId:credit.id});
      const journals=await client.journalEntry.count({where:{companyId}});
      const report=await runFinancialReportForActor(actor,"sale-report",{from:"2026-10-10",to:"2026-10-11",branchId,customerId:party.id});
      expect(report.rows).toHaveLength(2);expect(report.totals?.slice(-2)).toEqual(["50","50"]);expect(report.summary).toContainEqual({label:"Balance Due",value:"50",money:true});
      expect(report.nativeRowLinks?.[0]).toBe(`/workspace/account/sales/${sale.id}`);
      expect((await runFinancialReportForActor(actor,"sale-report",{from:"2026-10-10",to:"2026-10-10",branchId,customerId:party.id})).totals?.slice(-2)).toEqual(["100","100"]);
      expect(await client.journalEntry.count({where:{companyId}})).toBe(journals);
      await expect(runFinancialReportForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[otherBranch]},"sale-report",{from:"2026-10-10",to:"2026-10-11",branchId})).rejects.toThrow();
      await expect(runFinancialReportForActor({...actor,accountRole:"PROJECT_MANAGER"},"sale-report",{})).rejects.toThrow();
      expect((await runFinancialReportForActor(actor,"purchase-report",{from:"2026-10-10",to:"2026-10-11",branchId})).summary?.[0]).toMatchObject({label:"No. of Transactions"});
    });

    it("A084 purchase reports net debit notes once with exact remaining payable",async()=>{
      const vendor=await client.vendor.create({data:{companyId,name:"Report purchase vendor"}});
      const bill=await createCommercialDocumentForActor(actor,{type:"PURCHASE_BILL",purchasePurpose:"GENERAL_OFFICE",vendorInvoiceNumber:"REPORT-BILL",vendorInvoiceDate:"2026-10-10",branchId,partyId:vendor.id,issueDate:"2026-10-10",idempotencyKey:randomUUID(),lines:[{lineType:"CUSTOM",itemName:"Purchase report item",quantity:"1",rate:"200",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:bill.id});
      const line=await client.commercialDocumentLine.findFirstOrThrow({where:{documentId:bill.id}});
      const note=await createCommercialDocumentForActor(actor,{type:"DEBIT_NOTE",purchasePurpose:"GENERAL_OFFICE",sourceDocumentId:bill.id,branchId,partyId:vendor.id,issueDate:"2026-10-11",idempotencyKey:randomUUID(),lines:[{lineType:"CUSTOM",itemName:line.itemName,sourceCommercialLineId:line.id,quantity:"0.5",rate:"200",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:note.id});
      const result=await runFinancialReportForActor(actor,"purchase-report",{from:"2026-10-10",to:"2026-10-11",branchId,vendorId:vendor.id});expect(result.rows).toHaveLength(2);expect(result.totals?.slice(-2)).toEqual(["100","100"]);expect(result.summary?.[0].value).toBe("2");expect(result.nativeRowLinks?.[0]).toBe(`/workspace/account/purchases/${bill.id}`);
    });

    it("A066 issued cheque closes once into Cash without paying its vendor bill until closure",async()=>{
      const vendor=await client.vendor.create({data:{companyId,name:"Issued cheque vendor"}});
      const cash=await createMoneyAccountForActor(actor,{type:"CASH",branchId,name:"Issued cheque cash",creationRequestKey:randomUUID(),openingBalance:"300",openingDate:"2026-10-01",openingBranchId:branchId});
      const bill=await createCommercialDocumentForActor(actor,{type:"PURCHASE_BILL",purchasePurpose:"GENERAL_OFFICE",vendorInvoiceNumber:`ISSUED-${randomUUID().slice(0,8)}`,vendorInvoiceDate:"2026-10-10",idempotencyKey:randomUUID(),branchId,partyId:vendor.id,issueDate:"2026-10-10",lines:[{lineType:"CUSTOM",itemName:"Issued cheque purchase",quantity:"1",rate:"100",taxRate:"0"}]});await postCommercialDocumentForActor(actor,{documentId:bill.id});
      const original=await client.commercialDocument.findUniqueOrThrow({where:{id:bill.id}}),before=await client.journalEntry.count({where:{companyId}});
      const pending=await createSettlementForActor(actor,{type:"VENDOR_PAYMENT",idempotencyKey:randomUUID(),branchId,partyId:vendor.id,moneyAccountId:bankId,paymentMode:"CHEQUE",chequeNumber:randomUUID().slice(0,8),chequeDate:"2026-10-10",transactionDate:"2026-10-10",amount:"75",allocations:[{documentId:bill.id,amount:"75"}]});
      const cheque=await client.cheque.findFirstOrThrow({where:{companyId,settlementId:pending.id}});expect(cheque.status).toBe("ISSUED");expect(pending.journalEntryId).toBeNull();expect(await outstanding(bill.id)).toBe("100.00");expect(await client.journalEntry.count({where:{companyId}})).toBe(before);
      const request={action:"CLOSE",requestKey:randomUUID(),expectedVersion:0,actionDate:"2026-10-12",moneyAccountId:cash.id,description:"Paid vendor by cashed cheque"};
      const closed=await Promise.all([chequeFinancialActionForActor(actor,cheque.id,request),chequeFinancialActionForActor(actor,cheque.id,request)]);expect(closed[0].journalEntryId).toBe(closed[1].journalEntryId);expect(await outstanding(bill.id)).toBe("25.00");expect(await client.journalEntry.count({where:{companyId}})).toBe(before+1);
      const journal=await client.journalEntry.findUniqueOrThrow({where:{id:closed[0].journalEntryId!},include:{lines:true}});expect(journal.lines).toHaveLength(2);expect(journal.lines.find(line=>line.ledgerAccountId===cash.ledgerAccountId)?.credit.toFixed(2)).toBe("75.00");expect(journal.lines.reduce((n,line)=>n.add(line.debit).sub(line.credit),new Prisma.Decimal(0)).toString()).toBe("0");
      expect(await client.commercialDocument.findUniqueOrThrow({where:{id:bill.id}})).toEqual(original);
      const reopened=await chequeFinancialActionForActor(actor,cheque.id,{action:"REOPEN",requestKey:randomUUID(),expectedVersion:1,actionDate:"2026-10-13",reason:"Undo issued cheque closure"});expect(reopened.status).toBe("ISSUED");expect(await outstanding(bill.id)).toBe("100.00");expect(await client.commercialDocument.count({where:{companyId,vendorId:vendor.id,type:"PURCHASE_BILL"}})).toBe(1);
    });
    it("A066 closure respects the accounting period lock without changing bank, source or cheque",async()=>{
      const doc=await invoice(),{receipt,cheque}=await record(doc.id),before=await client.journalEntry.count({where:{companyId}}),year=await client.financialYear.findFirstOrThrow({where:{companyId}});
      await client.accountingPeriodLock.create({data:{companyId,financialYearId:year.id,lockedThrough:new Date("2026-10-12"),updatedById:userId}});
      try{await expect(chequeFinancialActionForActor(actor,cheque.id,{action:"CLOSE",requestKey:randomUUID(),expectedVersion:0,actionDate:"2026-10-12",moneyAccountId:bankId})).rejects.toThrow("PERIOD_LOCKED")}finally{await client.accountingPeriodLock.deleteMany({where:{companyId}})}
      expect(await outstanding(doc.id)).toBe("100.00");expect(await bankEffect(cheque.id)).toBe(0);expect(await client.journalEntry.count({where:{companyId}})).toBe(before);expect((await client.cheque.findUniqueOrThrow({where:{id:cheque.id}})).actionVersion).toBe(0);expect((await client.accountSettlement.findUniqueOrThrow({where:{id:receipt.id}})).status).toBe("PENDING_CHEQUE");
    });
    it("A066 failed closure audit rolls back the posted receipt, allocation and version together",async()=>{
      const doc=await invoice(),{receipt,cheque}=await record(doc.id),before=await client.journalEntry.count({where:{companyId}}),fn=`closure_fail_${randomUUID().replaceAll('-','')}`;
      await client.$executeRawUnsafe(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId"='${companyId}'::uuid AND NEW."eventType"='CHEQUE_FINANCIAL_ACTION' THEN RAISE EXCEPTION 'CLOSURE_AUDIT_FAULT'; END IF; RETURN NEW; END $$`);await client.$executeRawUnsafe(`CREATE TRIGGER ${fn} BEFORE INSERT ON account_operational_audits FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
      try{await expect(chequeFinancialActionForActor(actor,cheque.id,{action:"CLOSE",requestKey:randomUUID(),expectedVersion:0,actionDate:"2026-10-12",moneyAccountId:bankId})).rejects.toThrow()}finally{await client.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${fn} ON account_operational_audits`);await client.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`)}
      expect(await outstanding(doc.id)).toBe("100.00");expect(await bankEffect(cheque.id)).toBe(0);expect(await client.journalEntry.count({where:{companyId}})).toBe(before);expect((await client.cheque.findUniqueOrThrow({where:{id:cheque.id}})).actionVersion).toBe(0);const source=await client.accountSettlement.findUniqueOrThrow({where:{id:receipt.id}});expect(source.status).toBe("PENDING_CHEQUE");expect(source.journalEntryId).toBeNull();
    });

    it("A066 source linkage rejects excess precision, nonpositive amounts and another party's invoice without writes",async()=>{
      const otherParty=await client.customer.create({data:{companyId,branchId,name:"Different cheque source customer",isAccountCustomer:true}}),otherDoc=await invoice("100",otherParty.id);
      const data={branchId,moneyAccountId:bankId,partyId:customerId,status:"RECEIVED",chequeNumber:randomUUID().slice(0,8),chequeDate:"2026-10-10",amount:"100",requestKey:randomUUID()},before=await client.cheque.count({where:{companyId}}),journals=await client.journalEntry.count({where:{companyId}}),settlements=await client.accountSettlement.count({where:{companyId}});
      for(const amount of ["0","0.001","100.999","-1"]){await expect(createChequeForActor(actor,{...data,amount,requestKey:randomUUID()})).rejects.toThrow()}
      await expect(createChequeForActor(actor,{...data,sourceDocumentId:otherDoc.id})).rejects.toThrow();
      await expect(createChequeForActor({...actor,companyId:randomUUID()},{...data,sourceDocumentId:otherDoc.id})).rejects.toThrow();
      expect(await client.cheque.count({where:{companyId}})).toBe(before);expect(await client.accountSettlement.count({where:{companyId}})).toBe(settlements);expect(await client.journalEntry.count({where:{companyId}})).toBe(journals);expect(await outstanding(otherDoc.id)).toBe("100.00");
    });

    it("A086 retains unedited header/project snapshots and net ledger effects across sale replacement",async()=>{
      const previous=await client.accountSettings.findUniqueOrThrow({where:{companyId}});
      await client.accountSettings.update({where:{companyId},data:{enabledModules:["PROJECTS","PROJECT_COSTING"]}});
      try{
        const project=await client.project.create({data:{companyId,branchId,customerId,projectNumber:randomUUID(),name:"Original invoice project",createdById:userId}});
        const otherProject=await client.project.create({data:{companyId,branchId:otherBranch,customerId,projectNumber:randomUUID(),name:"Other branch project",createdById:userId}});
        const sale=await createCommercialDocumentForActor(actor,{type:"SALES_INVOICE",idempotencyKey:randomUUID(),branchId,partyId:customerId,projectId:project.id,issueDate:"2026-10-10",dueDate:"2026-10-25",paymentTerms:"Net 15 days",notes:"Retained invoice note",billingName:"Retained billing site",customerPoNumber:"ORIGINAL-PO",customerPoDate:"2026-10-09",transactionTime:"10:15",ewayBillNumber:"123456789012",stateOfSupplyCode:"29",freightAmount:"20",otherChargesAmount:"10",roundOffAmount:"-0.25",lines:[{lineType:"CUSTOM",itemName:"Original metadata service",itemCode:"META-1",description:"Retained description",specification:"Retained specification",unitName:"Square foot",unitSymbol:"sqft",quantity:"1",rate:"100",taxRate:"0"}]});
        await postCommercialDocumentForActor(actor,{documentId:sale.id});
        const original=await client.commercialDocument.findUniqueOrThrow({where:{id:sale.id},include:{lines:true}});
        const originalJournal=await client.journalLine.findMany({where:{companyId,journalEntry:{sourceId:sale.id,status:"POSTED"}}});
        await client.project.update({where:{id:project.id},data:{name:"Project renamed after invoice"}});
        const patch={idempotencyKey:randomUUID(),branchId,partyId:customerId,issueDate:"2026-10-10",lines:[{originalLineId:original.lines[0].id,lineType:"CUSTOM",quantity:"1",rate:"100"}]};
        await expect(replacePostedSaleForActor(actor,sale.id,{...patch,projectId:otherProject.id})).rejects.toThrow();
        expect(await client.commercialDocument.count({where:{companyId,sourceDocumentId:sale.id,type:"CREDIT_NOTE"}})).toBe(0);
        const replacement=await replacePostedSaleForActor(actor,sale.id,patch);
        const saved=await client.commercialDocument.findUniqueOrThrow({where:{id:replacement.id},include:{lines:true}});
        for(const field of ["projectId","projectReference","dueDate","paymentTerms","notes","billingName","customerPoNumber","customerPoDate","transactionTime","ewayBillNumber","stateOfSupplyCode","freightAmount","otherChargesAmount","roundOffAmount","grandTotal"] as const)expect(saved[field]).toEqual(original[field]);
        expect(saved.lines[0]).toMatchObject({itemName:"Original metadata service",itemCode:"META-1",description:"Retained description",specification:"Retained specification",unitName:"Square foot",unitSymbol:"sqft"});
        expect(await client.commercialDocument.findUniqueOrThrow({where:{id:sale.id},include:{lines:true}})).toEqual(original);
        const credit=await client.commercialDocument.findFirstOrThrow({where:{companyId,sourceDocumentId:sale.id,type:"CREDIT_NOTE",status:"POSTED"}});
        const combined=await client.journalLine.findMany({where:{companyId,journalEntry:{sourceId:{in:[sale.id,credit.id,replacement.id]},status:"POSTED"}}});
        const totals=(lines:typeof combined)=>{const sums=new Map<string,Prisma.Decimal>();for(const line of lines)sums.set(line.ledgerAccountId,(sums.get(line.ledgerAccountId)??new Prisma.Decimal(0)).add(line.debit).sub(line.credit));return [...sums].filter(([,value])=>!value.isZero()).map(([id,value])=>[id,value.toFixed(2)]).sort()};
        expect(totals(combined)).toEqual(totals(originalJournal));
        expect((await replacePostedSaleForActor(actor,sale.id,patch)).id).toBe(replacement.id);
      }finally{await client.accountSettings.update({where:{companyId},data:{enabledModules:previous.enabledModules}});}
    });

  },
);
