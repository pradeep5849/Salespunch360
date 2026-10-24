import {saleDetailForActor} from "./sale-detail";
import {loadPrintDocumentForActor} from "./print";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const url = process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if (url && (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || !new URL(url).pathname.endsWith("_ci"))) throw new Error("Isolated local *_ci database required");
const client = new PrismaClient({ datasources: { db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/checkpoint_ci" } } });
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }) }));
import { DEFAULT_LEDGER_ACCOUNTS } from "@/lib/accounting/default-accounts";
import { setPrivateStorageForTests } from "@/lib/storage";
import { submitSaleForActor } from "./sale-submit";
import { replacePostedSaleForActor } from "./sale-amendments";
import { createSettlementForActor } from "./commercial";
import { appendSaleAttachmentsForActor, downloadSaleAttachmentForActor, listSaleAttachmentsForActor } from "./sale-attachments";
import type { ProjectActor } from "./projects";

const companyId = randomUUID(), foreignId = randomUUID(), branchId = randomUUID(), userId = randomUUID(), customerId = randomUUID();
const actor = { id: userId, companyId, name: "Attachment admin", email: `${userId}@example.test`, role: "ACCOUNT_USER", accountRole: "ACCOUNT_ADMIN", accountAccessActive: true, isActive: true, salesAccessActive: false, branchAccessScope: "ALL_BRANCHES", branchIds: [] } as unknown as ProjectActor;
const raw = () => ({ type: "SALES_INVOICE", branchId, partyId: customerId, issueDate: "2026-10-21", idempotencyKey: randomUUID(), lines: [{ lineType: "CUSTOM", itemName: "Work", quantity: "1", rate: "100", taxRate: "0" }] });
const pdf = (name = "plan.pdf", text = "%PDF-1.7\nfixture") => new File([text], name, { type: "application/pdf" });
const objects = new Map<string, Buffer>();
const put = vi.fn(async (key: string, bytes: Buffer) => { objects.set(key, Buffer.from(bytes)); });
const remove = vi.fn(async (key: string) => { objects.delete(key); });
const save = (input:ReturnType<typeof raw>&{invoiceDescription?:string;notes?:string} = raw(), files = [pdf()]) => submitSaleForActor(actor, input, {}, "sale-save-receipt", files);
async function payWithDiscount(documentId:string){
 const settings=await client.accountSettings.findUniqueOrThrow({where:{companyId}});
 try{
  await client.accountSettings.update({where:{companyId},data:{transactionDefaults:{transactionPreferences:{discountDuringPayment:true,linkPayments:false}}}});
  await createSettlementForActor(actor,{type:"CUSTOMER_RECEIPT",idempotencyKey:randomUUID(),branchId,partyId:customerId,paymentMode:"CASH",amount:"90",transactionDate:"2026-10-21",allocations:[{documentId,amount:"100",discountAmount:"10"}]});
 }finally{await client.accountSettings.update({where:{companyId},data:{transactionDefaults:settings.transactionDefaults===null?Prisma.DbNull:settings.transactionDefaults as Prisma.InputJsonValue}})}
 return client.settlementAllocation.findFirstOrThrow({where:{companyId,documentId}});
}


describe.skipIf(!url)("A086/A087 private Sale attachments commit boundary", () => {
  beforeAll(async () => {
    for (const id of [companyId, foreignId]) await client.company.create({ data: { id, name: "Sale files fixture", slug: `sale-files-${id}`, productEdition: "SALESPUNCH360_ACCOUNT" } });
    await client.branch.create({ data: { id: branchId, companyId, name: "Main", code: "MAIN", isPrimary: true } });
    await client.user.create({ data: { id: userId, companyId, name: actor.name, email: actor.email, passwordHash: "fixture-only", role: "ACCOUNT_USER", accountRole: "ACCOUNT_ADMIN", accountAccessActive: true } });
    await client.customer.create({ data: { id: customerId, companyId, branchId, name: "Sale files customer", isAccountCustomer: true } });
    await client.accountSettings.create({ data: { companyId, enabledModules: [], transactionDefaults:{transactionPreferences:{linkPayments:false}} } });
    await client.financialYear.create({ data: { companyId, name: "2026-27", startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31") } });
    await client.ledgerAccount.createMany({ data: DEFAULT_LEDGER_ACCOUNTS.map(row => ({ ...row, companyId })) });
    setPrivateStorageForTests({ put, delete: remove, get: async key => { const bytes = objects.get(key); if (!bytes) throw new Error("file missing"); return bytes; } });
  });
  afterAll(async () => {
    setPrivateStorageForTests(undefined);
    await client.$transaction(async tx => {
      await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
      await tx.saleLifecycleSnapshot.deleteMany({where:{companyId}});
      await tx.saleRevisionCreditLine.deleteMany({where:{companyId}});
      await tx.saleRevisionCredit.deleteMany({where:{companyId}});
      await tx.saleReturnRevision.deleteMany({where:{companyId}});
      await tx.commercialAttachment.deleteMany({ where: { companyId } });
      await tx.commercialAuditEvent.deleteMany({ where: { companyId } });
      await tx.accountOperationalAudit.deleteMany({ where: { companyId } });
      await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
      await tx.advanceApplication.deleteMany({ where: { companyId } });
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

  it.each([true,false])("blank and omitted payment references preserve file Save retry identity in both orders (%s)",async blankFirst=>{
    const input=raw(),first=await submitSaleForActor(actor,input,blankFirst?{reference:""}:{},"sale-save-receipt",[pdf()]);
    const replay=await submitSaleForActor(actor,input,blankFirst?{}:{reference:""},"sale-save-receipt",[pdf()]);
    expect(replay.id).toBe(first.id);expect(await client.commercialAttachment.count({where:{companyId,documentId:first.id}})).toBe(1);expect(await client.journalEntry.count({where:{companyId,sourceId:first.id}})).toBe(1);
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

  it("adds newly selected files with a financial correction once and retains all original file references",async()=>{
    const saved=await save(),allocation=await payWithDiscount(saved.id),[original]=await listSaleAttachmentsForActor(actor,saved.id),correction={...raw(),lines:[{lineType:"CUSTOM",itemName:"Corrected work",quantity:"1",rate:"80",taxRate:"0"}]};put.mockClear();
    const [first,replay]=await Promise.all([replacePostedSaleForActor(actor,saved.id,correction,[pdf("new-support.pdf")]),replacePostedSaleForActor(actor,saved.id,correction,[pdf("new-support.pdf")])]);
    expect(first.id).toBe(replay.id);expect(first.grandTotal.toFixed(2)).toBe("80.00");expect(put).toHaveBeenCalledTimes(1);
    const credit=await client.accountSettlement.findFirstOrThrow({where:{companyId,receiptCreditSourceAllocationId:allocation.id}});
    expect(credit.amount.toFixed(2)).toBe("90.00");expect(credit.remainingAmount.toFixed(2)).toBe("10.00");
    const files=await listSaleAttachmentsForActor(actor,first.id);expect(files.map(file=>file.displayName)).toEqual(["plan.pdf","new-support.pdf"]);
    expect((await downloadSaleAttachmentForActor(actor,files[0].id)).data).toEqual((await downloadSaleAttachmentForActor(actor,original.id)).data);
    expect(await listSaleAttachmentsForActor(actor,saved.id)).toHaveLength(1);
    await expect(replacePostedSaleForActor(actor,saved.id,correction,[pdf("changed-support.pdf")])).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
    expect(await client.accountOperationalAudit.count({where:{companyId,eventType:"SALE_AMENDED",entityId:saved.id}})).toBe(1);
  });

  it("retains and independently clears invoice descriptions without rewriting original terms or posted history",async()=>{
    const source=await save({...raw(),invoiceDescription:"Site A description",notes:"Original terms"});
    const original=await client.commercialDocument.findUniqueOrThrow({where:{id:source.id}});expect(original.invoiceDescription).toBe("Site A description");
    await expect(client.commercialDocument.update({where:{id:source.id},data:{invoiceDescription:"Forbidden rewrite"}})).rejects.toThrow();
    const next=await replacePostedSaleForActor(actor,source.id,{...raw(),notes:"Revised terms"});
    expect(next.invoiceDescription).toBe("Site A description");expect(next.notes).toBe("Revised terms");
    const detail=await saleDetailForActor(actor,next.id);expect(detail.invoiceDescription).toBe("Site A description");
    const printed=await loadPrintDocumentForActor(actor,"SALES_INVOICE",next.id);expect(printed.document.invoiceDescription).toBe("Site A description");expect(printed.document.terms).toBe("Revised terms");
    const cleared=await replacePostedSaleForActor(actor,next.id,{...raw(),invoiceDescription:""});expect(cleared.invoiceDescription).toBeNull();expect(cleared.notes).toBe("Revised terms");
    expect((await client.commercialDocument.findUniqueOrThrow({where:{id:source.id}})).invoiceDescription).toBe("Site A description");expect((await client.commercialDocument.findUniqueOrThrow({where:{id:source.id}})).notes).toBe("Original terms");
  });
  it("retains the printed invoice number across immutable correction revisions",async()=>{
    const saved=await save(),original=await client.commercialDocument.findUniqueOrThrow({where:{id:saved.id},select:{id:true,documentNumber:true,issueDate:true,grandTotal:true,lines:{orderBy:{position:"asc"}}}}),firstRequest={...raw(),lines:[{lineType:"CUSTOM",itemName:"Work",quantity:"1",rate:"80",taxRate:"0"}]};
    const first=await replacePostedSaleForActor(actor,saved.id,firstRequest);expect(first.documentNumber).not.toBe(original.documentNumber);
    const detail=await saleDetailForActor(actor,first.id);expect(detail).toMatchObject({documentNumber:original.documentNumber,internalDocumentNumber:first.documentNumber,invoiceRevision:1,previousInvoiceId:saved.id});
    expect((await loadPrintDocumentForActor(actor,"SALES_INVOICE",first.id)).document).toMatchObject({number:original.documentNumber,title:"SALES INVOICE — Revision 1"});
    expect((await replacePostedSaleForActor(actor,saved.id,firstRequest)).id).toBe(first.id);expect(await client.accountOperationalAudit.count({where:{companyId,entityId:first.id,eventType:"SALE_INVOICE_IDENTITY"}})).toBe(1);
    const second=await replacePostedSaleForActor(actor,first.id,{...raw(),lines:[{lineType:"CUSTOM",itemName:"Work",quantity:"1",rate:"60",taxRate:"0"}]});expect((await saleDetailForActor(actor,second.id))).toMatchObject({documentNumber:original.documentNumber,internalDocumentNumber:second.documentNumber,invoiceRevision:2,previousInvoiceId:first.id});expect((await loadPrintDocumentForActor(actor,"SALES_INVOICE",second.id)).document.number).toBe(original.documentNumber);
    const unchanged=await client.commercialDocument.findUniqueOrThrow({where:{id:saved.id},select:{id:true,documentNumber:true,issueDate:true,grandTotal:true,lines:{orderBy:{position:"asc"}}}});expect(JSON.stringify(unchanged)).toBe(JSON.stringify(original));
    await expect(saleDetailForActor({...actor,companyId:foreignId},second.id)).rejects.toThrow();await expect(loadPrintDocumentForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},"SALES_INVOICE",second.id)).rejects.toThrow();
  });

  it("rolls back a file-bearing correction completely when its new upload fails",async()=>{
    const saved=await save(),beforeObjects=objects.size,before=await client.commercialDocument.findUniqueOrThrow({where:{id:saved.id}}),beforeJournals=await client.journalEntry.count({where:{companyId}}),series=await client.numberingSeries.findMany({where:{companyId}}),correction={...raw(),lines:[{lineType:"CUSTOM",itemName:"Changed",quantity:"1",rate:"80",taxRate:"0"}]};
    put.mockImplementationOnce(async(key,bytes)=>{objects.set(key,Buffer.from(bytes));throw new Error("correction storage unavailable")});
    await expect(replacePostedSaleForActor(actor,saved.id,correction,[pdf("support.pdf")])).rejects.toThrow("correction storage unavailable");
    expect(objects.size).toBe(beforeObjects);expect(await client.commercialDocument.findUniqueOrThrow({where:{id:saved.id}})).toEqual(before);
    expect(await client.journalEntry.count({where:{companyId}})).toBe(beforeJournals);expect(await client.numberingSeries.findMany({where:{companyId}})).toEqual(series);
    expect(await client.accountOperationalAudit.count({where:{companyId,eventType:"SALE_AMENDED",entityId:saved.id}})).toBe(0);
    const recovered=await replacePostedSaleForActor(actor,saved.id,correction,[pdf("support.pdf")]);expect(await listSaleAttachmentsForActor(actor,recovered.id)).toHaveLength(2);
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

  it("appends supporting files once without changing paid invoice, receipt, numbering or ledger history",async()=>{
    const input=raw(),saved=await save(input),allocation=await payWithDiscount(saved.id);
    expect(allocation.discountAmount.toFixed(2)).toBe("10.00");
    const snapshot=async()=>({document:await client.commercialDocument.findUniqueOrThrow({where:{id:saved.id}}),journals:await client.journalEntry.findMany({where:{companyId},orderBy:{id:"asc"},include:{lines:{orderBy:{id:"asc"}}}}),receipts:await client.accountSettlement.findMany({where:{companyId},orderBy:{id:"asc"}}),allocations:await client.settlementAllocation.findMany({where:{companyId},orderBy:{id:"asc"}}),series:await client.numberingSeries.findMany({where:{companyId},orderBy:{id:"asc"}})});
    const before=await snapshot(),key=randomUUID();put.mockClear();
    const [first,replay]=await Promise.all([appendSaleAttachmentsForActor(actor,saved.id,key,[pdf("support.pdf")]),appendSaleAttachmentsForActor(actor,saved.id,key.toUpperCase(),[pdf("support.pdf")])]);
    expect(first[0].id).toBe(replay[0].id);expect(put).toHaveBeenCalledTimes(1);
    expect(await snapshot()).toEqual(before);expect(await listSaleAttachmentsForActor(actor,saved.id)).toHaveLength(2);
    expect(await client.accountOperationalAudit.count({where:{companyId,eventType:"SALE_ATTACHMENTS_ADDED",entityId:saved.id}})).toBe(1);
    await expect(appendSaleAttachmentsForActor(actor,saved.id,key,[pdf("changed.pdf")])).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
    expect(JSON.stringify(first)).not.toMatch(/storageKey|contentHash|uploadedById/);
  });

  it("rolls back the append audit and all new files on storage failure, then safely retries",async()=>{
    const saved=await save(),key=randomUUID(),beforeObjects=objects.size,before=await client.commercialDocument.findUniqueOrThrow({where:{id:saved.id}});
    put.mockImplementationOnce(async(k,b)=>{objects.set(k,Buffer.from(b))}).mockRejectedValueOnce(new Error("append storage unavailable"));
    await expect(appendSaleAttachmentsForActor(actor,saved.id,key,[pdf("one.pdf"),pdf("two.pdf")])).rejects.toThrow("append storage unavailable");
    expect(objects.size).toBe(beforeObjects);expect(await listSaleAttachmentsForActor(actor,saved.id)).toHaveLength(1);
    expect(await client.accountOperationalAudit.count({where:{companyId,eventType:"SALE_ATTACHMENTS_ADDED",entityId:saved.id}})).toBe(0);
    await appendSaleAttachmentsForActor(actor,saved.id,key,[pdf("one.pdf"),pdf("two.pdf")]);
    expect(await listSaleAttachmentsForActor(actor,saved.id)).toHaveLength(3);expect(await client.commercialDocument.findUniqueOrThrow({where:{id:saved.id}})).toEqual(before);
  });

  it("denies append on foreign/unassigned/unauthorized documents before storage and rejects cross-document key reuse",async()=>{
    const saved=await save(),other=await save(),key=randomUUID();await appendSaleAttachmentsForActor(actor,saved.id,key,[pdf("support.pdf")]);put.mockClear();
    await expect(appendSaleAttachmentsForActor(actor,other.id,key,[pdf("support.pdf")])).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
    for(const denied of [{...actor,companyId:foreignId},{...actor,branchAccessScope:"SELECTED_BRANCHES" as const,branchIds:[]},{...actor,accountRole:null}])await expect(appendSaleAttachmentsForActor(denied,saved.id,randomUUID(),[pdf()])).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });

  it("protects append audit history and rejects incomplete posted-file append transactions at commit",async()=>{
    const saved=await save(),key=randomUUID();await appendSaleAttachmentsForActor(actor,saved.id,key,[pdf("support.pdf")]);
    const audit=await client.accountOperationalAudit.findFirstOrThrow({where:{companyId,eventType:"SALE_ATTACHMENTS_ADDED",entityId:saved.id}});
    await expect(client.accountOperationalAudit.update({where:{id:audit.id},data:{eventType:"OTHER"}})).rejects.toThrow("SALE_ATTACHMENT_AUDIT_IMMUTABLE");
    await expect(client.accountOperationalAudit.delete({where:{id:audit.id}})).rejects.toThrow("SALE_ATTACHMENT_AUDIT_IMMUTABLE");
    await expect(client.$transaction(async tx=>tx.accountOperationalAudit.create({data:{companyId,actorUserId:userId,eventType:"SALE_ATTACHMENTS_ADDED",entityType:"SALES_INVOICE",entityId:saved.id,metadata:{requestKey:randomUUID(),requestHash:"a".repeat(64),files:[{id:randomUUID(),position:2,displayName:"missing.pdf",mimeType:"application/pdf",sizeBytes:8,contentHash:"b".repeat(64)}]}}}))).rejects.toThrow("SALE_ATTACHMENT_APPEND_INCOMPLETE");
  });

  it("enforces the total stored-file limit without writing an append event or blob",async()=>{
    const saved=await save(),before=objects.size;put.mockClear();
    await expect(appendSaleAttachmentsForActor(actor,saved.id,randomUUID(),Array.from({length:50},(_,i)=>pdf(`${i}.pdf`)))).rejects.toThrow("SALE_ATTACHMENT_LIMIT");
    expect(put).not.toHaveBeenCalled();expect(objects.size).toBe(before);expect(await client.accountOperationalAudit.count({where:{companyId,eventType:"SALE_ATTACHMENTS_ADDED",entityId:saved.id}})).toBe(0);
  });
});
