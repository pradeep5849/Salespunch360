import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ reads: new Map<string, ReturnType<typeof vi.fn>>(), identity: vi.fn(), record: vi.fn(), audit: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db", () => {
  const tx = new Proxy({}, { get: (_, name) => {
    if (name === "company") return { findUniqueOrThrow: m.identity };
    if (name === "accountBackupRecord") return { create: m.record };
    if (name === "accountingAuditEvent") return { create: m.audit };
    const key = String(name);
    if (!m.reads.has(key)) m.reads.set(key, vi.fn().mockResolvedValue([]));
    return { findMany: m.reads.get(key) };
  }});
  return { db: { $transaction: async (fn: (value: unknown) => unknown, options: unknown) => { m.transaction(options); return fn(tx); } } };
});
import { createAccountBackupForActor } from "./utilities";
const actor = { id: "admin", companyId: "company-a", accountRole: "ACCOUNT_ADMIN" };
beforeEach(() => {
  vi.clearAllMocks(); m.reads.clear();
  m.identity.mockResolvedValue({ id: "company-a", name: "A", slug: "a", customers: [], vendors: [], accountProducts: [], projects: [], ledgerAccounts: [], financialYears: [] });
  m.record.mockImplementation(async ({ data }) => data);
});
describe("A088 backup shared financial dependencies", () => {
  it("includes scoped transfer attachments and immutable asset-funding history in one snapshot", async () => {
    const financialModels=["moneyTransferImage", "assetOwnerFunding", "ownerAssetFundingReturn", "assetOwnerFundingCancellation", "assetFundingConfirmation"];
    for(const name of financialModels)m.reads.set(name,vi.fn().mockResolvedValue([{id:name+"-original",companyId:actor.companyId,amount:"5000.00",objectKey:name==="moneyTransferImage"?"companies/company-a/money-transfer-images/private.png":undefined}]));
    const result = await createAccountBackupForActor(actor);
    const bundle = JSON.parse(new TextDecoder().decode(result.bytes));
    for (const name of ["moneyTransferImage", "assetOwnerFunding", "ownerAssetFundingReturn", "assetOwnerFundingCancellation", "assetFundingConfirmation"]) {
      expect(m.reads.get(name)).toHaveBeenCalledExactlyOnceWith({ where: { companyId: actor.companyId } });
      expect(bundle.data[name]).toMatchObject([{id:name+"-original",companyId:actor.companyId,amount:"5000.00"}]);
      expect(bundle.manifest.recordCounts[name]).toBe(1);
    }
    expect(m.transaction).toHaveBeenCalledWith({ isolationLevel: "RepeatableRead", timeout: 60000 });
    expect(result.manifest.uploadedFiles).toContain("private-storage backup");
  });
  it("denies backup generation before reading financial data for a non-administrator", async () => {
    await expect(createAccountBackupForActor({ ...actor, accountRole: "ACCOUNTANT" })).rejects.toThrow();
    expect(m.identity).not.toHaveBeenCalled(); expect(m.reads.size).toBe(0);
  });
});
