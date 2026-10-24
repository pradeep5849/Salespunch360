import {createHash} from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  storageGet: vi.fn(),
  reads: new Map<string, ReturnType<typeof vi.fn>>(),
  identity: vi.fn(),
  record: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/storage",()=>({privateStorage:()=>({get:m.storageGet})}));
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
  it("retains immutable private Sale file identity, order and content fingerprints",async()=>{
    const row={id:"sale-file",companyId:actor.companyId,documentId:"posted-sale",position:0,storageKey:"companies/company-a/sale-attachments/private",contentHash:"b".repeat(64),displayName:"Plan.pdf",mimeType:"application/pdf",sizeBytes:128};
    m.reads.set("commercialAttachment",vi.fn().mockResolvedValue([row]));
    const result=await createAccountBackupForActor(actor),bundle=JSON.parse(new TextDecoder().decode(result.bytes));
    expect(bundle.data.commercialAttachment).toEqual([row]);expect(bundle.manifest.recordCounts.commercialAttachment).toBe(1);
    expect(m.reads.get("commercialAttachment")).toHaveBeenCalledExactlyOnceWith({where:{companyId:actor.companyId},orderBy:[{documentId:"asc"},{position:"asc"}]});
    expect(result.manifest.uploadedFiles).toContain("private-storage backup");
  });
  it("retains scoped operational correction and attachment-append retry history",async()=>{
    const row={id:"append-audit",companyId:actor.companyId,actorUserId:"uploader",eventType:"SALE_ATTACHMENTS_ADDED",entityType:"SALES_INVOICE",entityId:"sale",metadata:{requestKey:"original-key",requestHash:"hash",files:[{id:"file"}]}};
    m.reads.set("accountOperationalAudit",vi.fn().mockResolvedValue([row]));
    const bundle=JSON.parse(new TextDecoder().decode((await createAccountBackupForActor(actor)).bytes));
    expect(bundle.data.accountOperationalAudit).toEqual([row]);expect(bundle.manifest.recordCounts.accountOperationalAudit).toBe(1);
    expect(m.reads.get("accountOperationalAudit")).toHaveBeenCalledExactlyOnceWith({where:{companyId:actor.companyId},orderBy:[{createdAt:"asc"},{id:"asc"}]});
  });
  it("denies backup generation before reading financial data for a non-administrator", async () => {
    await expect(
      createAccountBackupForActor({ ...actor, accountRole: "ACCOUNTANT" }),
    ).rejects.toThrow();
    expect(m.identity).not.toHaveBeenCalled();
    expect(m.reads.size).toBe(0);
  });
});

it("embeds and verifies private bytes only on explicit file-inclusive backup",async()=>{
 const key="companies/company-a/items/photo";m.identity.mockResolvedValue({id:"company-a",name:"A",slug:"a",customers:[],vendors:[],accountProducts:[{id:"item",photoObjectKey:key}],projects:[],ledgerAccounts:[],financialYears:[]});m.storageGet.mockResolvedValue(Buffer.from("photo"));
 const output=await createAccountBackupForActor(actor,false,true),bundle=JSON.parse(new TextDecoder().decode(output.bytes));
 expect(bundle.manifest.formatVersion).toBe(3);expect(bundle.manifest.privateFileCount).toBe(1);expect(bundle.privateFiles[0]).toMatchObject({objectKey:key,size:5,encoding:"base64",data:Buffer.from("photo").toString("base64")});expect(m.record).toHaveBeenCalledOnce();
});
it("never records successful backup when a required private file cannot be read",async()=>{
 m.identity.mockResolvedValue({id:"company-a",name:"A",slug:"a",logoObjectKey:"companies/company-a/logo",customers:[],vendors:[],accountProducts:[],projects:[],ledgerAccounts:[],financialYears:[]});m.storageGet.mockRejectedValue(new Error("missing"));
 await expect(createAccountBackupForActor(actor,false,true)).rejects.toThrow("BACKUP_FILE_UNAVAILABLE");expect(m.record).not.toHaveBeenCalled();expect(m.audit).not.toHaveBeenCalled();
});

it("includes immutable party-transfer photo references in the private file inventory",async()=>{
 const key="companies/company-a/party-transfers/source/photo.webp";m.reads.set("accountOperationalAudit",vi.fn().mockResolvedValue([{entityId:"source",entityType:"PARTY_TRANSFER",eventType:"PARTY_TRANSFER_POSTED",metadata:{photoObjectKey:key,photoSha256:createHash("sha256").update("photo").digest("hex")}}]));m.storageGet.mockResolvedValue(Buffer.from("photo"));const bundle=JSON.parse(new TextDecoder().decode((await createAccountBackupForActor(actor,false,true)).bytes));expect(bundle.data.partyTransferPhotos).toEqual([{sourceId:"source",photoObjectKey:key,expectedSha256:createHash("sha256").update("photo").digest("hex")}]);expect(bundle.privateFiles).toEqual(expect.arrayContaining([expect.objectContaining({objectKey:key,data:Buffer.from("photo").toString("base64")})]));expect(bundle.manifest.recordCounts.partyTransferPhotos).toBe(1);
});

it.each(["saleReturnRevision","saleRevisionCredit","saleRevisionCreditLine","saleLifecycleSnapshot"])("retains company-scoped immutable Sale correction history: %s",async name=>{
 const row={id:`${name}-original`,companyId:actor.companyId,originalAmount:"100.00",appliedAmount:"80.00",excessAmount:"20.00"};m.reads.set(name,vi.fn().mockResolvedValue([row]));
 const result=await createAccountBackupForActor(actor);const bundle=JSON.parse(new TextDecoder().decode(result.bytes));
 expect(m.reads.get(name)).toHaveBeenCalledExactlyOnceWith({where:{companyId:actor.companyId}});expect(bundle.data[name]).toEqual([row]);expect(bundle.manifest.recordCounts[name]).toBe(1);
});
