import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const url = process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if (url && (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || !new URL(url).pathname.endsWith("_ci"))) throw new Error("Isolated local *_ci database required");
const client = new PrismaClient({ datasources: { db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/checkpoint_ci" } } });
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }) }));
import { DEFAULT_LEDGER_ACCOUNTS } from "@/lib/accounting/default-accounts";
import { setPrivateStorageForTests } from "@/lib/storage";
import { submitSaleForActor } from "./sale-submit";
import { replacePostedSaleForActor } from "./sale-amendments";
import { downloadSaleAttachmentForActor, listSaleAttachmentsForActor } from "./sale-attachments";
import type { ProjectActor } from "./projects";

const companyId = randomUUID(), foreignId = randomUUID(), branchId = randomUUID(), userId = randomUUID(), customerId = randomUUID();
const actor = { id: userId, companyId, name: "Attachment admin", email: `${userId}@example.test`, role: "ACCOUNT_USER", accountRole: "ACCOUNT_ADMIN", accountAccessActive: true, isActive: true, salesAccessActive: false, branchAccessScope: "ALL_BRANCHES", branchIds: [] } as unknown as ProjectActor;
const raw = () => ({ type: "SALES_INVOICE", branchId, partyId: customerId, issueDate: "2026-10-21", idempotencyKey: randomUUID(), lines: [{ lineType: "CUSTOM", itemName: "Work", quantity: "1", rate: "100", taxRate: "0" }] });
const pdf = (name = "plan.pdf", text = "%PDF-1.7\nfixture") => new File([text], name, { type: "application/pdf" });
const objects = new Map<string, Buffer>();
const put = vi.fn(async (key: string, bytes: Buffer) => { objects.set(key, Buffer.from(bytes)); });
const remove = vi.fn(async (key: string) => { objects.delete(key); });
const save = (input = raw(), files = [pdf()]) => submitSaleForActor(actor, input, {}, "sale-save-receipt", files);

describe.skipIf(!url)("A086/A087 private Sale attachments commit boundary", () => {
  beforeAll(async () => {
    for (const id of [companyId, foreignId]) await client.company.create({ data: { id, name: "Sale files fixture", slug: `sale-files-${id}`, productEdition: "SALESPUNCH360_ACCOUNT" } });
    await client.branch.create({ data: { id: branchId, companyId, name: "Main", code: "MAIN", isPrimary: true } });
    await client.user.create({ data: { id: userId, companyId, name: actor.name, email: actor.email, passwordHash: "fixture-only", role: "ACCOUNT_USER", accountRole: "ACCOUNT_ADMIN", accountAccessActive: true } });
    await client.customer.create({ data: { id: customerId, companyId, branchId, name: "Sale files customer", isAccountCustomer: true } });
    await client.accountSettings.create({ data: { companyId, enabledModules: [] } });
    await client.financialYear.create({ data: { companyId, name: "2026-27", startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31") } });
    await client.ledgerAccount.createMany({ data: DEFAULT_LEDGER_ACCOUNTS.map(row => ({ ...row, companyId })) });
    setPrivateStorageForTests({ put, delete: remove, get: async key => { const bytes = objects.get(key); if (!bytes) throw new Error("file missing"); return bytes; } });
  });
  afterAll(async () => {
    setPrivateStorageForTests(undefined);
    await client.$transaction(async tx => {
      await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
      await tx.commercialAttachment.deleteMany({ where: { companyId } });
      await tx.commercialAuditEvent.deleteMany({ where: { companyId } });
      await tx.accountOperationalAudit.deleteMany({ where: { companyId } });
      await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
      await tx.settlementAllocation.deleteMany({ where: { companyId } });
      await tx.accountSettlement.deleteMany({ where: { companyId } });
      await tx.commercialDocumentLine.deleteMany({ where: { companyId } });
      await tx.commercialDocument.deleteMany({ where: { companyId } });
      await tx.journalLine.deleteMany({ where: { companyId } });
      await tx.journalEntry.deleteMany({ where: { companyId } });
      await tx.numberingSeries.deleteMany({ where: { companyId } });
      await tx.ledgerAccount.deleteMany({ where: { companyId } });
      await tx.financialYear.deleteMany({ where: { companyId } });
      await tx.accountSettings.deleteMany({ where: { companyId } });
      await tx.customer.deleteMany({ where: { companyId } });
      await tx.user.deleteMany({ where: { companyId } });
      await tx.branch.deleteMany({ where: { companyId } });
      await tx.company.deleteMany({ where: { id: { in: [companyId, foreignId] } } });
    });
    await client.$disconnect();
  });

  it("posts one balanced Sale with one private file under concurrent retry", async () => {
    const input = raw(); put.mockClear();
    const [first, replay] = await Promise.all([save(input), save(input)]);
    expect(first.id).toBe(replay.id); expect(first.status).toBe("POSTED"); expect(put).toHaveBeenCalledTimes(1);
    const rows = await listSaleAttachmentsForActor(actor, first.id);
    expect(rows).toHaveLength(1); expect(JSON.stringify(rows)).not.toMatch(/storageKey|contentHash|uploadedById|companyId/);
    expect((await downloadSaleAttachmentForActor(actor, rows[0].id)).data.toString()).toContain("%PDF-");
    const sale = await client.commercialDocument.findUniqueOrThrow({ where: { id: first.id } });
    expect(await client.journalEntry.count({ where: { companyId, sourceId: first.id, status: "POSTED" } })).toBe(1);
    const sums = await client.journalLine.aggregate({ where: { companyId, journalEntryId: sale.journalEntryId! }, _sum: { debit: true, credit: true } });
    expect(sums._sum.debit?.toFixed(2)).toBe("100.00"); expect(sums._sum.credit?.toFixed(2)).toBe("100.00");
  });

  it("rejects changed filename, bytes or removed selection using the same Save key", async () => {
    const input = raw(); await save(input);
    for (const files of [[pdf("changed.pdf")], [pdf("plan.pdf", "%PDF-1.7\nchanged")], []]) await expect(save(input, files)).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
    expect(await client.commercialDocument.count({ where: { companyId, creationRequestKey: input.idempotencyKey } })).toBe(1);
  });

  it("binds receipt intent to a file Save key so a changed retry cannot add a payment",async()=>{
    const input=raw(),saved=await save(input),before=await client.accountSettlement.count({where:{companyId}});
    await expect(submitSaleForActor(actor,input,{receivedAmount:"100",paymentType:"CASH"},"sale-save-receipt",[pdf()])).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
    expect(await client.accountSettlement.count({where:{companyId}})).toBe(before);
    expect((await client.commercialDocument.findUniqueOrThrow({where:{id:saved.id}})).balanceDue.toFixed(2)).toBe("100.00");
  });

  it("rolls back files, document, numbering and journals if storing a later file fails", async () => {
    const input = raw(), beforeObjects = objects.size, beforeJournals = await client.journalEntry.count({ where: { companyId } }), series = await client.numberingSeries.findMany({ where: { companyId } });
    put.mockImplementationOnce(async (key, bytes) => { objects.set(key, Buffer.from(bytes)); }).mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(save(input, [pdf("one.pdf"), pdf("two.pdf")])).rejects.toThrow("storage unavailable");
    expect(objects.size).toBe(beforeObjects); expect(await client.commercialDocument.count({ where: { companyId, creationRequestKey: input.idempotencyKey } })).toBe(0);
    expect(await client.numberingSeries.findMany({ where: { companyId } })).toEqual(series); expect(await client.journalEntry.count({ where: { companyId } })).toBe(beforeJournals);
    const recovered = await save(input, [pdf("one.pdf"), pdf("two.pdf")]); expect(await listSaleAttachmentsForActor(actor, recovered.id)).toHaveLength(2);
  });

  it("rolls back attachments and posting if receipt validation fails later in Save", async () => {
    const input = raw(), beforeObjects = objects.size, beforeJournals = await client.journalEntry.count({ where: { companyId } });
    await expect(submitSaleForActor(actor, input, { receivedAmount: "100", paymentType: "BANK", moneyAccountId: randomUUID() }, "sale-save-receipt", [pdf()])).rejects.toThrow();
    expect(await client.commercialDocument.count({ where: { companyId, creationRequestKey: input.idempotencyKey } })).toBe(0);
    expect(await client.journalEntry.count({ where: { companyId } })).toBe(beforeJournals); expect(objects.size).toBe(beforeObjects);
  });

  it("denies foreign company, unassigned branch and missing permissions before storage", async () => {
    const saved = await save(), [file] = await listSaleAttachmentsForActor(actor, saved.id); put.mockClear();
    for (const denied of [{ ...actor, companyId: foreignId }, { ...actor, branchAccessScope: "SELECTED_BRANCHES" as const, branchIds: [] }, { ...actor, accountRole: null }]) {
      await expect(listSaleAttachmentsForActor(denied, saved.id)).rejects.toThrow();
      await expect(downloadSaleAttachmentForActor(denied, file.id)).rejects.toThrow();
      await expect(submitSaleForActor(denied, raw(), {}, "sale-save-receipt", [pdf()])).rejects.toThrow();
    }
    expect(put).not.toHaveBeenCalled();
  });

  it("detects corrupted private bytes and blocks DB changes to posted attachment history", async () => {
    const saved = await save(), [file] = await listSaleAttachmentsForActor(actor, saved.id), row = await client.commercialAttachment.findUniqueOrThrow({ where: { id: file.id } }), bytes = objects.get(row.storageKey)!;
    objects.set(row.storageKey, Buffer.from("corrupt"));
    try { await expect(downloadSaleAttachmentForActor(actor, file.id)).rejects.toThrow("SALE_ATTACHMENT_CORRUPT"); } finally { objects.set(row.storageKey, bytes); }
    await expect(client.commercialAttachment.update({ where: { id: file.id }, data: { displayName: "replacement.pdf" } })).rejects.toThrow("COMMERCIAL_ATTACHMENT_HISTORY_IMMUTABLE");
    await expect(client.commercialAttachment.delete({ where: { id: file.id } })).rejects.toThrow("COMMERCIAL_ATTACHMENT_HISTORY_IMMUTABLE");
    await expect(client.commercialAttachment.create({ data: { ...row, id: randomUUID(), position: 1 } })).rejects.toThrow("COMMERCIAL_ATTACHMENT_SAVE_REQUIRED");
  });

  it("rejects invalid files and missing stable Save keys before any write", async () => {
    put.mockClear(); const before = await client.commercialDocument.count({ where: { companyId } });
    await expect(save(raw(), [pdf("bad.pdf", "not PDF")])).rejects.toThrow("INVALID_SALE_ATTACHMENT");
    const input = raw(); delete (input as Partial<typeof input>).idempotencyKey;
    await expect(save(input)).rejects.toThrow("SALE_ATTACHMENT_REQUEST_KEY_REQUIRED");
    expect(put).not.toHaveBeenCalled(); expect(await client.commercialDocument.count({ where: { companyId } })).toBe(before);
  });

  it("retains original and replacement file history through an atomic financial correction and retry",async()=>{
    const saved=await save(),[original]=await listSaleAttachmentsForActor(actor,saved.id),beforeObjects=objects.size;
    const correction={...raw(),lines:[{lineType:"CUSTOM",itemName:"Corrected work",quantity:"1",rate:"200",taxRate:"0"}]};
    const replacement=await replacePostedSaleForActor(actor,saved.id,correction),replay=await replacePostedSaleForActor(actor,saved.id,correction);
    expect(replacement.id).toBe(replay.id);expect(replacement.grandTotal.toFixed(2)).toBe("200.00");
    const [copy]=await listSaleAttachmentsForActor(actor,replacement.id);expect(copy.id).not.toBe(original.id);expect(copy.displayName).toBe(original.displayName);
    expect((await listSaleAttachmentsForActor(actor,saved.id))[0].id).toBe(original.id);expect(objects.size).toBe(beforeObjects);
    expect((await downloadSaleAttachmentForActor(actor,copy.id)).data).toEqual((await downloadSaleAttachmentForActor(actor,original.id)).data);
    expect(await client.commercialAttachment.count({where:{companyId,documentId:replacement.id}})).toBe(1);
  });

  it("enforces Account edition/module availability before reading or uploading private bytes",async()=>{
    const saved=await save(),[file]=await listSaleAttachmentsForActor(actor,saved.id);put.mockClear();
    await client.company.update({where:{id:companyId},data:{productEdition:"SALESPUNCH360"}});
    try{
      await expect(listSaleAttachmentsForActor(actor,saved.id)).rejects.toThrow();
      await expect(downloadSaleAttachmentForActor(actor,file.id)).rejects.toThrow();
      await expect(save()).rejects.toThrow();expect(put).not.toHaveBeenCalled();
    }finally{await client.company.update({where:{id:companyId},data:{productEdition:"SALESPUNCH360_ACCOUNT"}})}
  });
});
