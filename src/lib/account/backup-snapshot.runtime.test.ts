import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  reads: new Map<string, ReturnType<typeof vi.fn>>(),
  identity: vi.fn(),
  record: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => {
  const tx = new Proxy(
    {},
    {
      get: (_, name) => {
        if (name === "company") return { findUniqueOrThrow: m.identity };
        if (name === "accountBackupRecord") return { create: m.record };
        if (name === "accountingAuditEvent") return { create: m.audit };
        const key = String(name);
        if (!m.reads.has(key)) m.reads.set(key, vi.fn().mockResolvedValue([]));
        return { findMany: m.reads.get(key) };
      },
    },
  );
  return {
    db: {
      $transaction: async (
        fn: (value: unknown) => unknown,
        options: unknown,
      ) => {
        m.transaction(options);
        return fn(tx);
      },
    },
  };
});
import { createAccountBackupForActor } from "./utilities";
const actor = {
  id: "admin",
  companyId: "company-a",
  accountRole: "ACCOUNT_ADMIN",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.reads.clear();
  m.identity.mockResolvedValue({
    id: "company-a",
    name: "A",
    slug: "a",
    customers: [],
    vendors: [],
    accountProducts: [],
    projects: [],
    ledgerAccounts: [],
    financialYears: [],
  });
  m.record.mockImplementation(async ({ data }) => data);
});
describe("A088 backup shared financial dependencies", () => {
  it("includes scoped transfer attachments and immutable asset-funding history in one snapshot", async () => {
    const financialModels = [
      "moneyTransferImage",
      "assetOwnerFunding",
      "ownerAssetFundingReturn",
      "assetOwnerFundingCancellation",
      "assetFundingConfirmation",
    ];
    for (const name of financialModels)
      m.reads.set(
        name,
        vi
          .fn()
          .mockResolvedValue([
            {
              id: name + "-original",
              companyId: actor.companyId,
              amount: "5000.00",
              objectKey:
                name === "moneyTransferImage"
                  ? "companies/company-a/money-transfer-images/private.png"
                  : undefined,
            },
          ]),
      );
    const result = await createAccountBackupForActor(actor);
    const bundle = JSON.parse(new TextDecoder().decode(result.bytes));
    for (const name of [
      "moneyTransferImage",
      "assetOwnerFunding",
      "ownerAssetFundingReturn",
      "assetOwnerFundingCancellation",
      "assetFundingConfirmation",
    ]) {
      expect(m.reads.get(name)).toHaveBeenCalledExactlyOnceWith({
        where: { companyId: actor.companyId },
      });
      expect(bundle.data[name]).toMatchObject([
        {
          id: name + "-original",
          companyId: actor.companyId,
          amount: "5000.00",
        },
      ]);
      expect(bundle.manifest.recordCounts[name]).toBe(1);
    }
    expect(m.transaction).toHaveBeenCalledWith({
      isolationLevel: "RepeatableRead",
      timeout: 60000,
    });
    expect(result.manifest.uploadedFiles).toContain("private-storage backup");
  });
  it("retains report favourites with user and company identity in the same isolated snapshot", async () => {
    m.reads.set(
      "accountReportFavourite",
      vi
        .fn()
        .mockResolvedValue([
          {
            companyId: actor.companyId,
            userId: "report-user",
            reportKey: "tax",
          },
        ]),
    );
    const bundle = JSON.parse(
      new TextDecoder().decode(
        (await createAccountBackupForActor(actor)).bytes,
      ),
    );
    expect(bundle.data.accountReportFavourite).toEqual([
      { companyId: actor.companyId, userId: "report-user", reportKey: "tax" },
    ]);
    expect(
      m.reads.get("accountReportFavourite"),
    ).toHaveBeenCalledExactlyOnceWith({
      where: { companyId: actor.companyId },
      orderBy: [{ userId: "asc" }, { reportKey: "asc" }],
    });
  });
  it("retains reusable expense item identity, retry fingerprints and private photo references", async () => {
    const item={id:"original-item",companyId:actor.companyId,name:"Delivery",normalizedName:"delivery",creationRequestKey:"original-key",creationRequestHash:"original-hash",photoObjectKey:"companies/company-a/expense-items/photo",photoMimeType:"image/png",isActive:false};
    m.reads.set("expenseItem",vi.fn().mockResolvedValue([item]));
    const result=await createAccountBackupForActor(actor),bundle=JSON.parse(new TextDecoder().decode(result.bytes));
    expect(bundle.data.expenseItem).toEqual([item]);expect(bundle.manifest.recordCounts.expenseItem).toBe(1);
    expect(m.reads.get("expenseItem")).toHaveBeenCalledExactlyOnceWith({where:{companyId:actor.companyId},orderBy:[{name:"asc"},{id:"asc"}]});
    expect(result.manifest.uploadedFiles).toContain("private-storage backup");
  });
  it("retains private quotation attachment references and original revision identities",async()=>{
    const row={id:"attachment-original",companyId:actor.companyId,revisionId:"issued-revision",storageKey:"companies/company-a/quotation-attachments/private",contentHash:"a".repeat(64),requestKey:"retry-key",displayName:"Plan.pdf",mimeType:"application/pdf",sizeBytes:128};
    m.reads.set("quotationAttachment",vi.fn().mockResolvedValue([row]));
    const bundle=JSON.parse(new TextDecoder().decode((await createAccountBackupForActor(actor)).bytes));
    expect(bundle.data.quotationAttachment).toEqual([row]);expect(bundle.manifest.recordCounts.quotationAttachment).toBe(1);
    expect(m.reads.get("quotationAttachment")).toHaveBeenCalledExactlyOnceWith({where:{companyId:actor.companyId},orderBy:[{createdAt:"asc"},{id:"asc"}]});
  });
  it("denies backup generation before reading financial data for a non-administrator", async () => {
    await expect(
      createAccountBackupForActor({ ...actor, accountRole: "ACCOUNTANT" }),
    ).rejects.toThrow();
    expect(m.identity).not.toHaveBeenCalled();
    expect(m.reads.size).toBe(0);
  });
});
