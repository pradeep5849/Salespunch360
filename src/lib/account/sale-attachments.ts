import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { privateStorage } from "@/lib/storage";
import { requireAccountModules } from "./modules";
import { commercialCreationHash } from "./commercial-request-identity";
import { preparePrivateDocumentFiles, type PreparedPrivateDocumentFile } from "./private-document-files";
import type { ProjectActor } from "./projects";

export class SaleAttachmentError extends Error {}
export const saleAttachmentManifest = (files: PreparedPrivateDocumentFile[]) => commercialCreationHash({
  files: files.map(({ displayName, mimeType, contentHash, sizeBytes }) => ({ displayName, mimeType, contentHash, sizeBytes })),
});
async function authorize(actor: ProjectActor, write = false) {
  if (!actor.companyId || !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", write ? "ACCOUNT_SALES_ENTRY" : "ACCOUNT_LEDGER_VIEW") ||
      write && !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_JOURNAL_POST")) throw new AuthorizationError();
  await requireAccountModules(actor, "SALES");
}
const scope = (actor: ProjectActor) => actor.branchAccessScope === "SELECTED_BRANCHES" ? { branchId: { in: actor.branchIds ?? [] } } : {};
export async function prepareSaleAttachments(actor: ProjectActor, files: File[]) {
  if (!files.length) return [];
  await authorize(actor, true);
  return preparePrivateDocumentFiles(files, kind => new SaleAttachmentError(kind === "LIMIT" ? "SALE_ATTACHMENT_LIMIT" : "INVALID_SALE_ATTACHMENT"));
}

/** Called only inside the authorized Sale Save transaction, before posting. */
export async function storeSaleAttachmentsInTx(tx: Prisma.TransactionClient, actor: ProjectActor, documentId: string, files: PreparedPrivateDocumentFile[], attemptedKeys: Set<string>) {
  if (!files.length) return;
  await authorize(actor, true);
  const document = await tx.commercialDocument.findFirst({ where: { id: documentId, companyId: actor.companyId, type: "SALES_INVOICE", ...scope(actor) }, select: { id: true, status: true } });
  if (!document) throw new AuthorizationError();
  const prior = await tx.commercialAttachment.findMany({ where: { companyId: actor.companyId, documentId }, orderBy: { position: "asc" } });
  if (prior.length) {
    if (saleAttachmentManifest(prior.map(row => ({ ...row, bytes: Buffer.alloc(0) }))) !== saleAttachmentManifest(files)) throw new SaleAttachmentError("IDEMPOTENCY_KEY_REUSED");
    return;
  }
  if (document.status !== "DRAFT") throw new SaleAttachmentError("SALE_ATTACHMENT_SAVE_REQUIRED");
  for (const [position, file] of files.entries()) {
    const storageKey = `companies/${actor.companyId}/sale-attachments/${documentId}/${randomUUID()}`;
    attemptedKeys.add(storageKey);
    await privateStorage().put(storageKey, file.bytes);
    await tx.commercialAttachment.create({ data: { companyId: actor.companyId, documentId, position, displayName: file.displayName, mimeType: file.mimeType, sizeBytes: file.sizeBytes, contentHash: file.contentHash, storageKey, uploadedById: actor.id } });
  }
}

/** Preserve immutable originals when the approved correction workflow creates
 * a replacement. Copy references only; never upload or remove historical bytes. */
export async function copySaleAttachmentsInTx(tx: Prisma.TransactionClient, actor: ProjectActor, from: string, to: string) {
  await authorize(actor, true);
  const documents=await tx.commercialDocument.findMany({where:{id:{in:[from,to]},companyId:actor.companyId,type:"SALES_INVOICE",...scope(actor)},select:{id:true,branchId:true,status:true}});
  const source=documents.find(row=>row.id===from),target=documents.find(row=>row.id===to);
  if(!source||!target||source.branchId!==target.branchId||target.status!=="DRAFT"||source.status!=="POSTED")throw new AuthorizationError();
  const rows=await tx.commercialAttachment.findMany({where:{companyId:actor.companyId,documentId:from},orderBy:{position:"asc"}});
  if(rows.length)await tx.commercialAttachment.createMany({data:rows.map(row=>({...row,id:randomUUID(),documentId:to}))});
}

/** A failed commit response is ambiguous: retain bytes if the DB cannot prove
 * they are unreferenced. Never remove potentially committed financial files. */
export async function cleanSaleAttachmentAttempts(companyId: string, keys: Set<string>) {
  for (const key of keys) await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${companyId}::uuid FOR UPDATE`;
    if (!await tx.commercialAttachment.count({ where: { companyId, storageKey: key } })) await privateStorage().delete(key);
  }, { timeout: 30000 }).catch(() => undefined);
}
export async function listSaleAttachmentsForActor(actor: ProjectActor, documentId: string) {
  await authorize(actor); z.string().uuid().parse(documentId);
  return db.$transaction(async tx => {
    if (!await tx.commercialDocument.findFirst({ where: { id: documentId, companyId: actor.companyId, type: "SALES_INVOICE", ...scope(actor) }, select: { id: true } })) throw new AuthorizationError();
    return tx.commercialAttachment.findMany({ where: { companyId: actor.companyId, documentId }, orderBy: { position: "asc" }, take: 50, select: { id: true, displayName: true, mimeType: true, sizeBytes: true, createdAt: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function downloadSaleAttachmentForActor(actor: ProjectActor, id: string) {
  await authorize(actor); z.string().uuid().parse(id);
  const row = await db.commercialAttachment.findFirst({ where: { id, companyId: actor.companyId, document: { type: "SALES_INVOICE", ...scope(actor) } } });
  if (!row) throw new AuthorizationError();
  const data = await privateStorage().get(row.storageKey);
  if (data.length !== row.sizeBytes || createHash("sha256").update(data).digest("hex") !== row.contentHash) throw new SaleAttachmentError("SALE_ATTACHMENT_CORRUPT");
  return { data, name: row.displayName, mimeType: row.mimeType };
}
