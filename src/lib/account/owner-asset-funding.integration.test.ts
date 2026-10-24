import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { ProjectActor } from "./projects";
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
  allocateOwnerAssetFundingForActor,
  cancelOwnerAssetFundingForActor,
  confirmAssetFundingForActor,
  ownerFundingRepaymentOptionsForActor,
  ownerAssetFundingSummaryForActor,
} from "./owner-asset-funding";
import { postOwnerTransactionForActor } from "./money";
import { updateAssetForActor } from "./assets";
import {
  postJournalForActor,
  reverseJournalForActor,
} from "@/lib/accounting/service";
const companies: string[] = [];
async function fixture() {
  const companyId = randomUUID(),
    branchId = randomUUID(),
    userId = randomUUID(),
    yearId = randomUUID(),
    assetId = randomUUID(),
    ownerId = randomUUID();
  await client.company.create({
    data: {
      id: companyId,
      name: "Funding fixture",
      slug: `funding-${companyId}`,
      productEdition: "SALESPUNCH360_ACCOUNT",
    },
  });
  companies.push(companyId);
  await client.accountSettings.create({
    data: { companyId, enabledModules: ["ASSETS"] },
  });
  await client.branch.create({
    data: { id: branchId, companyId, name: "Funding branch", code: "MAIN" },
  });
  await client.user.create({
    data: {
      id: userId,
      companyId,
      name: "Funding accountant",
      email: `${userId}@example.test`,
      passwordHash: "isolated-fixture",
      role: "ACCOUNT_USER",
      accountRole: "ACCOUNT_ADMIN",
      accountAccessActive: true,
    },
  });
  await client.financialYear.create({
    data: {
      id: yearId,
      companyId,
      name: "2026",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
    },
  });
  const actor = {
    id: userId,
    companyId,
    name: "Funding accountant",
    email: `${userId}@example.test`,
    role: "ACCOUNT_USER",
    isActive: true,
    managerType: null,
    salesRole: null,
    salesAccessActive: false,
    accountAccessActive: true,
    accountRole: "ACCOUNT_ADMIN",
    branchAccessScope: "ALL_BRANCHES",
    branchIds: [],
  } as ProjectActor;
  const ledger = async (
    code: string,
    accountClass: "ASSET" | "EQUITY" | "LIABILITY",
    normalBalance: "DEBIT" | "CREDIT",
  ) =>
    client.ledgerAccount.create({
      data: { companyId, code, name: code, accountClass, normalBalance },
    });
  const bankLedger = await ledger("BANK", "ASSET", "DEBIT"),
    equipment = await ledger("EQUIPMENT", "ASSET", "DEBIT"),
    equity = await ledger("OPENING-EQUITY", "EQUITY", "CREDIT"),
    capital = await ledger("OWNER-CAPITAL", "EQUITY", "CREDIT"),
    drawings = await ledger("OWNER-DRAWINGS", "EQUITY", "DEBIT"),
    loan = await ledger("OWNER-LOAN", "LIABILITY", "CREDIT");
  const bank = await client.moneyAccount.create({
    data: {
      companyId,
      branchId,
      name: "Funding bank",
      type: "BANK",
      ledgerAccountId: bankLedger.id,
    },
  });
  await client.ownerFinancialAccount.create({
    data: {
      id: ownerId,
      companyId,
      name: "Alice",
      capitalLedgerId: capital.id,
      drawingsLedgerId: drawings.id,
      loanLedgerId: loan.id,
    },
  });
  await client.asset.create({
    data: {
      id: assetId,
      companyId,
      branchId,
      assetNumber: "FUND-001",
      name: "Equipment",
      assetType: "EQUIPMENT",
      purchaseDate: new Date("2026-10-10"),
      purchaseValue: "40000",
      assetLedgerId: equipment.id,
      createdById: userId,
    },
  });
  const journal = async (
    lines: Array<{ ledgerAccountId: string; debit: string; credit: string }>,
  ) =>
    postJournalForActor(actor, {
      financialYearId: yearId,
      branchId,
      entryDate: "2026-10-10",
      sourceType: "MANUAL_JOURNAL",
      sourceId: randomUUID(),
      postingPurpose: "PRIMARY",
      lines,
    });
  await journal([
    { ledgerAccountId: bankLedger.id, debit: "15000", credit: "0" },
    { ledgerAccountId: equity.id, debit: "0", credit: "15000" },
  ]);
  const investment = await postOwnerTransactionForActor(actor, {
    ownerFinancialAccountId: ownerId,
    moneyAccountId: bank.id,
    branchId,
    type: "INVESTMENT",
    amount: "30000",
    transactionDate: "2026-10-10",
    idempotencyKey: randomUUID(),
  });
  await journal([
    { ledgerAccountId: equipment.id, debit: "40000", credit: "0" },
    { ledgerAccountId: bankLedger.id, debit: "0", credit: "40000" },
  ]);
  const fundingInput = {
    branchId,
    assetId,
    ownerFinancialAccountId: ownerId,
    contributionTransactionId: investment.id,
    amount: "30000",
    allocationDate: "2026-10-11",
    requestKey: randomUUID(),
    expectedPurchaseValue: "40000",
    confirmCompanyRemainder: true,
  };
  const balance = async (id: string) => {
    const value = await client.journalLine.aggregate({
      where: {
        companyId,
        ledgerAccountId: id,
        journalEntry: { status: { in: ["POSTED", "REVERSED"] } },
      },
      _sum: { debit: true, credit: true },
    });
    return new Prisma.Decimal(value._sum.debit ?? 0)
      .sub(value._sum.credit ?? 0)
      .toFixed(2);
  };
  const repayment = (
    fundingId: string,
    amount = "5000",
    idempotencyKey = randomUUID(),
  ) => ({
    ownerFinancialAccountId: ownerId,
    moneyAccountId: bank.id,
    branchId,
    type: "CAPITAL_WITHDRAWAL",
    amount,
    transactionDate: "2026-10-11",
    idempotencyKey,
    fundingReturns: [{ fundingId, amount }],
  });
  return {
    actor,
    companyId,
    branchId,
    yearId,
    assetId,
    ownerId,
    bank,
    bankLedger,
    equipment,
    equity,
    capital,
    investment,
    journal,
    fundingInput,
    balance,
    repayment,
  };
}
describe.skipIf(!url)(
  "A065 explicit retained-asset funding against isolated PostgreSQL",
  () => {
    afterAll(async () => {
      for (const companyId of companies.reverse())
        await client.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
          await tx.ownerAssetFundingReturn.deleteMany({ where: { companyId } });
          await tx.assetOwnerFundingCancellation.deleteMany({
            where: { companyId },
          });
          await tx.assetFundingConfirmation.deleteMany({
            where: { companyId },
          });
          await tx.assetOwnerFunding.deleteMany({ where: { companyId } });
          await tx.ownerTransaction.deleteMany({ where: { companyId } });
          await tx.ownerFinancialAccount.deleteMany({ where: { companyId } });
          await tx.asset.deleteMany({ where: { companyId } });
          await tx.accountOperationalAudit.deleteMany({ where: { companyId } });
          await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
          await tx.journalLine.deleteMany({ where: { companyId } });
          await tx.journalEntry.deleteMany({ where: { companyId } });
          await tx.moneyAccount.deleteMany({ where: { companyId } });
          await tx.ledgerAccount.deleteMany({ where: { companyId } });
          await tx.numberingSeries.deleteMany({ where: { companyId } });
          await tx.financialYear.deleteMany({ where: { companyId } });
          await tx.user.deleteMany({ where: { companyId } });
          await tx.branch.deleteMany({ where: { companyId } });
          await tx.accountSettings.deleteMany({ where: { companyId } });
          await tx.company.deleteMany({ where: { id: companyId } });
        });
      await client.$disconnect();
    });
    it("repays owner funding without changing equipment cost or duplicating the payment", async () => {
      const f = await fixture(),
        before = await client.journalEntry.count({
          where: { companyId: f.companyId },
        }),
        allocation = await allocateOwnerAssetFundingForActor(
          f.actor,
          f.fundingInput,
        );
      expect(
        await client.journalEntry.count({ where: { companyId: f.companyId } }),
      ).toBe(before);
      expect(
        (await ownerAssetFundingSummaryForActor(f.actor))[0],
      ).toMatchObject({
        ownerFunded: "30000.00",
        companyFunded: "10000.00",
        fundingStatus: "CONFIRMED",
      });
      const input = f.repayment(allocation.id),
        paid = await postOwnerTransactionForActor(f.actor, input),
        after = await client.journalEntry.count({
          where: { companyId: f.companyId },
        });
      expect(
        (await ownerAssetFundingSummaryForActor(f.actor))[0],
      ).toMatchObject({
        purchaseValue: "40000.00",
        ownerFunded: "25000.00",
        companyFunded: "15000.00",
      });
      expect(await f.balance(f.bankLedger.id)).toBe("0.00");
      expect(await f.balance(f.equipment.id)).toBe("40000.00");
      expect(await f.balance(f.capital.id)).toBe("-25000.00");
      expect(
        (
          await client.ownerTransaction.findUniqueOrThrow({
            where: { id: f.investment.id },
          })
        ).amount.toFixed(2),
      ).toBe("30000.00");
      expect((await postOwnerTransactionForActor(f.actor, input)).id).toBe(
        paid.id,
      );
      expect(
        await client.journalEntry.count({ where: { companyId: f.companyId } }),
      ).toBe(after);
      await expect(
        postOwnerTransactionForActor(f.actor, { ...input, fundingReturns: [] }),
      ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
      await f.journal([
        { ledgerAccountId: f.bankLedger.id, debit: "25000", credit: "0" },
        { ledgerAccountId: f.equity.id, debit: "0", credit: "25000" },
      ]);
      await postOwnerTransactionForActor(
        f.actor,
        f.repayment(allocation.id, "25000"),
      );
      expect(
        (await ownerAssetFundingSummaryForActor(f.actor))[0],
      ).toMatchObject({ ownerFunded: "0.00", companyFunded: "40000.00" });
      expect(await f.balance(f.bankLedger.id)).toBe("0.00");
      expect(await f.balance(f.equipment.id)).toBe("40000.00");
    });
    it("keeps legacy funding unclassified until explicitly confirmed", async () => {
      const f = await fixture();
      expect(
        (await ownerAssetFundingSummaryForActor(f.actor))[0],
      ).toMatchObject({
        companyFunded: null,
        unallocated: "40000.00",
        fundingStatus: "UNALLOCATED",
      });
      const input = {
        assetId: f.assetId,
        branchId: f.branchId,
        expectedPurchaseValue: "40000",
        confirmed: true,
        reason: "Company-funded holding confirmed",
        requestKey: randomUUID(),
      };
      const row = await confirmAssetFundingForActor(f.actor, input);
      expect((await confirmAssetFundingForActor(f.actor, input)).id).toBe(
        row.id,
      );
      expect(
        (await ownerAssetFundingSummaryForActor(f.actor))[0],
      ).toMatchObject({
        companyFunded: "40000.00",
        fundingStatus: "CONFIRMED",
      });
      await confirmAssetFundingForActor(f.actor, {
        ...input,
        requestKey: randomUUID(),
        confirmed: false,
        reason: "Funding not established",
      });
      expect(
        (await ownerAssetFundingSummaryForActor(f.actor))[0].companyFunded,
      ).toBeNull();
    });
    it("caps attribution and prevents manual journals from consuming reserved capital", async () => {
      const f = await fixture();
      await expect(
        allocateOwnerAssetFundingForActor(f.actor, {
          ...f.fundingInput,
          amount: "30001",
        }),
      ).rejects.toThrow("ASSET_FUNDING_EXCEEDS_AVAILABLE");
      const allocation = await allocateOwnerAssetFundingForActor(
        f.actor,
        f.fundingInput,
      );
      await expect(
        f.journal([
          { ledgerAccountId: f.capital.id, debit: "100", credit: "0" },
          { ledgerAccountId: f.bankLedger.id, debit: "0", credit: "100" },
        ]),
      ).rejects.toThrow("ASSET_FUNDING_ATTRIBUTION_REQUIRED");
      await expect(
        postOwnerTransactionForActor(f.actor, {
          ...f.repayment(allocation.id),
          fundingReturns: [],
        }),
      ).rejects.toThrow("ASSET_FUNDING_ATTRIBUTION_REQUIRED");
      await f.journal([
        { ledgerAccountId: f.equity.id, debit: "100", credit: "0" },
        { ledgerAccountId: f.capital.id, debit: "0", credit: "100" },
      ]);
      await postOwnerTransactionForActor(f.actor, {
        ...f.repayment(allocation.id, "100"),
        fundingReturns: [],
      });
      expect(
        (await ownerAssetFundingSummaryForActor(f.actor))[0].ownerFunded,
      ).toBe("30000.00");
    });
    it("serializes competing payments and allocation retries", async () => {
      const f = await fixture(),
        [first, second] = await Promise.all([
          allocateOwnerAssetFundingForActor(f.actor, f.fundingInput),
          allocateOwnerAssetFundingForActor(f.actor, f.fundingInput),
        ]);
      expect(first.id).toBe(second.id);
      const results = await Promise.allSettled([
        postOwnerTransactionForActor(f.actor, f.repayment(first.id)),
        postOwnerTransactionForActor(f.actor, f.repayment(first.id)),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(
        await client.ownerAssetFundingReturn.count({
          where: { companyId: f.companyId },
        }),
      ).toBe(1);
      expect(await f.balance(f.bankLedger.id)).toBe("0.00");
    });
    it("restores funding on repayment reversal and requires correction before reversing its contribution", async () => {
      const f = await fixture(),
        allocation = await allocateOwnerAssetFundingForActor(
          f.actor,
          f.fundingInput,
        ),
        paid = await postOwnerTransactionForActor(
          f.actor,
          f.repayment(allocation.id),
        );
      await expect(
        cancelOwnerAssetFundingForActor(f.actor, {
          fundingId: allocation.id,
          reason: "Correct allocation",
          requestKey: randomUUID(),
          expectedPurchaseValue: "40000",
          confirmCompanyRemainder: true,
        }),
      ).rejects.toThrow("ASSET_FUNDING_HAS_REPAYMENTS");
      await expect(
        reverseJournalForActor(f.actor, {
          journalEntryId: f.investment.journalEntryId,
          entryDate: "2026-10-12",
          reason: "Correct contribution",
        }),
      ).rejects.toThrow("OWNER_CONTRIBUTION_HAS_ASSET_FUNDING");
      const correction = await reverseJournalForActor(f.actor, {
        journalEntryId: paid.journalEntryId,
        entryDate: "2026-10-12",
        reason: "Correct capital repayment",
      });
      await expect(reverseJournalForActor(f.actor, {
        journalEntryId: correction.id,
        entryDate: "2026-10-13",
        reason: "Undo correction",
      })).rejects.toThrow("MANAGED_CORRECTION_REVERSAL_REQUIRED");
      expect(
        (await ownerAssetFundingSummaryForActor(f.actor))[0],
      ).toMatchObject({ ownerFunded: "30000.00", companyFunded: "10000.00" });
      expect(await f.balance(f.bankLedger.id)).toBe("5000.00");
      const count = await client.journalEntry.count({
        where: { companyId: f.companyId },
      });
      await cancelOwnerAssetFundingForActor(f.actor, {
        fundingId: allocation.id,
        reason: "Correct allocation",
        requestKey: randomUUID(),
        expectedPurchaseValue: "40000",
        confirmCompanyRemainder: true,
      });
      expect(
        await client.journalEntry.count({ where: { companyId: f.companyId } }),
      ).toBe(count);
      expect(
        (
          await client.assetOwnerFunding.findUniqueOrThrow({
            where: { id: allocation.id },
          })
        ).amount.toFixed(2),
      ).toBe("30000.00");
      await expect(reverseJournalForActor(f.actor,{journalEntryId:f.investment.journalEntryId,entryDate:"2026-10-13",reason:"Correct contribution"})).rejects.toThrow("INSUFFICIENT_MONEY_BALANCE");
      await f.journal([{ledgerAccountId:f.bankLedger.id,debit:"25000",credit:"0"},{ledgerAccountId:f.equity.id,debit:"0",credit:"25000"}]);
      await reverseJournalForActor(f.actor,{journalEntryId:f.investment.journalEntryId,entryDate:"2026-10-13",reason:"Correct contribution"});
      expect(await f.balance(f.bankLedger.id)).toBe("0.00");expect(await f.balance(f.equipment.id)).toBe("40000.00");
    });
    it("rejects a cost correction below retained owner funding",async()=>{
      const f=await fixture();
      await allocateOwnerAssetFundingForActor(f.actor,f.fundingInput);
      await expect(updateAssetForActor(f.actor,f.assetId,{purchaseValue:"20000"})).rejects.toThrow("ASSET_FUNDING_EXCEEDS_AVAILABLE");
      expect((await client.asset.findUniqueOrThrow({where:{id:f.assetId}})).purchaseValue.toFixed(2)).toBe("40000.00");
    });
    it("keeps multiple owners and assets separate and caps reuse of the original contribution", async () => {
      const f=await fixture();
      const secondAsset=await client.asset.create({data:{companyId:f.companyId,branchId:f.branchId,assetNumber:"FUND-002",name:"Second equipment",assetType:"EQUIPMENT",purchaseDate:new Date("2026-10-10"),purchaseValue:"15000",createdById:f.actor.id}});
      const original=await client.ownerFinancialAccount.findUniqueOrThrow({where:{id:f.ownerId}});
      const nextLedger=async(source:string,code:string)=>{const row=await client.ledgerAccount.findUniqueOrThrow({where:{id:source}});return client.ledgerAccount.create({data:{companyId:f.companyId,code,name:code,accountClass:row.accountClass,normalBalance:row.normalBalance}})};
      const capital=await nextLedger(original.capitalLedgerId,"PARTNER-CAPITAL"),drawings=await nextLedger(original.drawingsLedgerId,"PARTNER-DRAWINGS"),loan=await nextLedger(original.loanLedgerId,"PARTNER-LOAN");
      const partner=await client.ownerFinancialAccount.create({data:{companyId:f.companyId,name:"Partner",partyType:"PARTNER",capitalLedgerId:capital.id,drawingsLedgerId:drawings.id,loanLedgerId:loan.id}});
      const contribution=await postOwnerTransactionForActor(f.actor,{ownerFinancialAccountId:partner.id,moneyAccountId:f.bank.id,branchId:f.branchId,type:"INVESTMENT",amount:"10000",transactionDate:"2026-10-10",idempotencyKey:randomUUID()});
      const count=await client.journalEntry.count({where:{companyId:f.companyId}});
      await allocateOwnerAssetFundingForActor(f.actor,{...f.fundingInput,amount:"20000"});
      await allocateOwnerAssetFundingForActor(f.actor,{...f.fundingInput,assetId:secondAsset.id,expectedPurchaseValue:"15000",amount:"10000",requestKey:randomUUID()});
      await allocateOwnerAssetFundingForActor(f.actor,{...f.fundingInput,ownerFinancialAccountId:partner.id,contributionTransactionId:contribution.id,amount:"10000",requestKey:randomUUID()});
      const summary=await ownerAssetFundingSummaryForActor(f.actor);
      expect(summary.find(row=>row.id===f.assetId)).toMatchObject({ownerFunded:"30000.00",companyFunded:"10000.00"});
      expect(summary.find(row=>row.id===secondAsset.id)).toMatchObject({ownerFunded:"10000.00",companyFunded:"5000.00"});
      await expect(allocateOwnerAssetFundingForActor(f.actor,{...f.fundingInput,amount:"1",requestKey:randomUUID()})).rejects.toThrow("ASSET_FUNDING_EXCEEDS_AVAILABLE");
      expect(await client.journalEntry.count({where:{companyId:f.companyId}})).toBe(count);
      const options=await ownerFundingRepaymentOptionsForActor(f.actor);
      expect(options.filter(row=>row.ownerFinancialAccountId===partner.id)).toHaveLength(1);
      expect(options.filter(row=>row.ownerFinancialAccountId===f.ownerId)).toHaveLength(2);
    });
    it("prevents repayment reversal from overfunding an asset after released funding is reallocated", async () => {
      const f = await fixture();
      const first = await allocateOwnerAssetFundingForActor(f.actor, f.fundingInput);
      const payment = await postOwnerTransactionForActor(f.actor, f.repayment(first.id));
      const contribution = await postOwnerTransactionForActor(f.actor, {
        ownerFinancialAccountId:f.ownerId,moneyAccountId:f.bank.id,branchId:f.branchId,
        type:"INVESTMENT",amount:"15000",transactionDate:"2026-10-12",idempotencyKey:randomUUID(),
      });
      await allocateOwnerAssetFundingForActor(f.actor, {...f.fundingInput,contributionTransactionId:contribution.id,amount:"15000",allocationDate:"2026-10-12",requestKey:randomUUID()});
      expect((await ownerAssetFundingSummaryForActor(f.actor))[0]).toMatchObject({ownerFunded:"40000.00",companyFunded:"0.00"});
      const count=await client.journalEntry.count({where:{companyId:f.companyId}});
      await expect(reverseJournalForActor(f.actor,{journalEntryId:payment.journalEntryId,entryDate:"2026-10-13",reason:"Correct repayment"})).rejects.toThrow("ASSET_FUNDING_REPAYMENT_REALLOCATED");
      expect(await client.journalEntry.count({where:{companyId:f.companyId}})).toBe(count);
      expect(await f.balance(f.bankLedger.id)).toBe("15000.00");
      await client.asset.update({where:{id:f.assetId},data:{status:"DISPOSED"}});
      expect(await ownerAssetFundingSummaryForActor(f.actor)).toEqual([]);
      expect(await ownerFundingRepaymentOptionsForActor(f.actor)).toEqual([]);
      expect(await client.assetOwnerFunding.count({where:{companyId:f.companyId}})).toBe(2);
    });
    it("retains recorded repayment obligations when asset creation is disabled", async () => {
      const f = await fixture(),
        allocation = await allocateOwnerAssetFundingForActor(
          f.actor,
          f.fundingInput,
        );
      await client.accountSettings.update({
        where: { companyId: f.companyId },
        data: { enabledModules: [] },
      });
      expect(
        (await ownerFundingRepaymentOptionsForActor(f.actor)).map(
          (row) => row.id,
        ),
      ).toEqual([allocation.id]);
      await postOwnerTransactionForActor(f.actor, f.repayment(allocation.id));
      expect(await f.balance(f.bankLedger.id)).toBe("0.00");
      await expect(
        allocateOwnerAssetFundingForActor(f.actor, {
          ...f.fundingInput,
          requestKey: randomUUID(),
        }),
      ).rejects.toThrow("MODULE_DISABLED:ASSETS");
    });
    it("denies foreign branches, roles and disabled assets", async () => {
      const f = await fixture(),
        other = await fixture();
      await expect(
        allocateOwnerAssetFundingForActor(f.actor, {
          ...f.fundingInput,
          assetId: other.assetId,
        }),
      ).rejects.toThrow("INVALID_ASSET_FUNDING_SOURCE");
      await expect(
        allocateOwnerAssetFundingForActor(
          { ...f.actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
          f.fundingInput,
        ),
      ).rejects.toThrow();
      await expect(
        allocateOwnerAssetFundingForActor(
          { ...f.actor, accountRole: "PROJECT_MANAGER" },
          f.fundingInput,
        ),
      ).rejects.toThrow();
      await client.accountSettings.update({
        where: { companyId: f.companyId },
        data: { enabledModules: [] },
      });
      await expect(ownerAssetFundingSummaryForActor(f.actor)).rejects.toThrow(
        "MODULE_DISABLED:ASSETS",
      );
    });
  },
);
