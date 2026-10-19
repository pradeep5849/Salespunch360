import {createHash,randomUUID} from "node:crypto";
import {Prisma,type QuotationAttachment} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {requireAccountModules} from "@/lib/account/modules";
import {attachmentDisplayName} from "@/lib/account/attachment-name";
import {privateStorage} from "@/lib/storage";
import type {QuotationActor} from "./service";
const request=z.object({documentId:z.string().uuid(),revisionNumber:z.number().int().min(0),requestKey:z.string().uuid()}).strict();
const MAX_BYTES=10*1024*1024,MAX_ATTACHMENTS=50;
export class QuotationAttachmentError extends Error {}
const scope=(actor:QuotationActor)=>actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{};
async function authorize(actor:QuotationActor,write=false){
 if(!actor.companyId||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT",write?"ACCOUNT_QUOTATION_EDIT":"ACCOUNT_QUOTATION_VIEW"))throw new AuthorizationError();
 await requireAccountModules(actor,"QUOTATIONS_BOQ");
}
const safe=(row:QuotationAttachment)=>({id:row.id,displayName:row.displayName,mimeType:row.mimeType,sizeBytes:row.sizeBytes,createdAt:row.createdAt});
async function current(tx:Prisma.TransactionClient,actor:QuotationActor,documentId:string,revisionNumber:number,write=false){
 const doc=await tx.quotationDocument.findFirst({where:{id:documentId,companyId:actor.companyId!,...scope(actor)},select:{id:true,currentRevisionNumber:true,status:true}});
 if(!doc)throw new AuthorizationError();
 if(doc.currentRevisionNumber!==revisionNumber)throw new QuotationAttachmentError("QUOTATION_REVISION_CHANGED");
 if(write&&doc.status!=="DRAFT")throw new QuotationAttachmentError("DRAFT_NOT_EDITABLE");
 const revision=await tx.quotationRevision.findFirst({where:{companyId:actor.companyId!,documentId,revisionNumber},select:{id:true,status:true}});
 if(!revision)throw new QuotationAttachmentError("QUOTATION_REVISION_CHANGED");
 if(write&&revision.status!=="DRAFT")throw new QuotationAttachmentError("DRAFT_NOT_EDITABLE");
 return revision;
}
async function lock(tx:Prisma.TransactionClient,actor:QuotationActor,documentId:string){
 await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${actor.companyId}::uuid FOR UPDATE`;
 await tx.$queryRaw`SELECT "id" FROM "quotation_documents" WHERE "id"=${documentId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
}
export function validQuotationAttachment(bytes:Buffer,mime:string){
 return bytes.length>0&&bytes.length<=MAX_BYTES&&(
  mime==="application/pdf"&&bytes.subarray(0,5).toString()==="%PDF-"||
  mime==="image/png"&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||
  mime==="image/jpeg"&&bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255
 );
}
/** Never delete bytes while a copied issued revision still references them.
 * All quotation writes acquire the same company lock before copying/removing refs. */
async function discardUnreferenced(companyId:string,key:string){
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${companyId}::uuid FOR UPDATE`;
  if(await tx.quotationAttachment.count({where:{companyId,storageKey:key}})===0)await privateStorage().delete(key);
 },{timeout:30000});
}
/** Prepare files in memory only. Nothing is persisted until the explicit Save transaction. */
export async function prepareQuotationCreationAttachments(actor:QuotationActor,files:File[]){
 if(!files.length)return [];
 await authorize(actor,true);
 if(files.length>MAX_ATTACHMENTS||files.reduce((sum,file)=>sum+file.size,0)>MAX_BYTES)throw new QuotationAttachmentError("QUOTATION_ATTACHMENT_LIMIT");
 return Promise.all(files.map(async file=>{
  if(!file.size||file.size>MAX_BYTES)throw new QuotationAttachmentError("INVALID_QUOTATION_ATTACHMENT");
  const bytes=Buffer.from(await file.arrayBuffer());
  if(!validQuotationAttachment(bytes,file.type))throw new QuotationAttachmentError("INVALID_QUOTATION_ATTACHMENT");
  return {bytes,displayName:attachmentDisplayName(file.name),mimeType:file.type,contentHash:createHash("sha256").update(bytes).digest("hex"),sizeBytes:bytes.length};
 }));
}
export async function storeQuotationCreationAttachmentsInTx(tx:Prisma.TransactionClient,actor:QuotationActor,documentId:string,revisionId:string,files:Awaited<ReturnType<typeof prepareQuotationCreationAttachments>>,attemptedKeys:Set<string>){
 for(const file of files){
  const requestKey=randomUUID(),storageKey=`companies/${actor.companyId}/quotation-attachments/${documentId}/0/${requestKey}`;
  attemptedKeys.add(storageKey);
  await privateStorage().put(storageKey,file.bytes);
  const requestHash=createHash("sha256").update(JSON.stringify({documentId,revisionNumber:0,requestKey,displayName:file.displayName,mimeType:file.mimeType,contentHash:file.contentHash})).digest("hex");
  await tx.quotationAttachment.create({data:{companyId:actor.companyId!,revisionId,requestKey,requestHash,displayName:file.displayName,mimeType:file.mimeType,sizeBytes:file.sizeBytes,contentHash:file.contentHash,storageKey,uploadedById:actor.id}});
 }
}
/** Also covers rolled-back serializable attempts. Ambiguous database failures retain bytes. */
export async function cleanQuotationCreationAttachmentAttempts(companyId:string,keys:Set<string>){
 for(const key of keys)await discardUnreferenced(companyId,key).catch(()=>undefined);
}
export async function listQuotationAttachmentsForActor(actor:QuotationActor,documentId:string,revisionNumber:number){
 await authorize(actor);z.string().uuid().parse(documentId);z.number().int().min(0).parse(revisionNumber);
 return db.$transaction(async tx=>{
  const revision=await current(tx,actor,documentId,revisionNumber);
  return (await tx.quotationAttachment.findMany({where:{companyId:actor.companyId!,revisionId:revision.id},orderBy:[{createdAt:"asc"},{id:"asc"}],take:MAX_ATTACHMENTS})).map(safe);
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
export async function uploadQuotationAttachmentForActor(actor:QuotationActor,raw:unknown,file:File){
 await authorize(actor,true);const input=request.parse(raw);
 if(!file.size||file.size>MAX_BYTES)throw new QuotationAttachmentError("INVALID_QUOTATION_ATTACHMENT");
 const bytes=Buffer.from(await file.arrayBuffer());
 if(!validQuotationAttachment(bytes,file.type))throw new QuotationAttachmentError("INVALID_QUOTATION_ATTACHMENT");
 const displayName=attachmentDisplayName(file.name),contentHash=createHash("sha256").update(bytes).digest("hex"),requestHash=createHash("sha256").update(JSON.stringify({...input,displayName,mimeType:file.type,contentHash})).digest("hex");
 const key=`companies/${actor.companyId}/quotation-attachments/${input.documentId}/${input.revisionNumber}/${input.requestKey}`;
 let attemptedStorage=false;
 try{return await db.$transaction(async tx=>{
  await lock(tx,actor,input.documentId);const revision=await current(tx,actor,input.documentId,input.revisionNumber,true);
  const prior=await tx.quotationAttachment.findUnique({where:{companyId_revisionId_requestKey:{companyId:actor.companyId!,revisionId:revision.id,requestKey:input.requestKey}}});
  if(prior){if(prior.requestHash!==requestHash)throw new QuotationAttachmentError("IDEMPOTENCY_KEY_REUSED");return safe(prior)}
  if(await tx.quotationAttachment.count({where:{companyId:actor.companyId!,revisionId:revision.id}})>=MAX_ATTACHMENTS)throw new QuotationAttachmentError("QUOTATION_ATTACHMENT_LIMIT");
  attemptedStorage=true;await privateStorage().put(key,bytes);
  const row=await tx.quotationAttachment.create({data:{companyId:actor.companyId!,revisionId:revision.id,requestKey:input.requestKey,requestHash,displayName,mimeType:file.type,sizeBytes:bytes.length,contentHash,storageKey:key,uploadedById:actor.id}});
  await tx.quotationAuditEvent.create({data:{companyId:actor.companyId!,documentId:input.documentId,actorId:actor.id,eventType:"DRAFT_UPDATED",revisionNumber:input.revisionNumber,note:`Attachment added: ${row.id}`}});
  return safe(row);
 },{timeout:30000});}catch(error){
  // A failed commit response is ambiguous: re-check all references under the
  // company lock. If the database is unavailable, retain bytes rather than
  // risk deleting an attachment whose transaction actually committed.
  if(attemptedStorage)await discardUnreferenced(actor.companyId!,key).catch(()=>undefined);
  throw error;
 }
}
export async function downloadQuotationAttachmentForActor(actor:QuotationActor,id:string){
 await authorize(actor);z.string().uuid().parse(id);
 const row=await db.quotationAttachment.findFirst({where:{id,companyId:actor.companyId!,revision:{document:{companyId:actor.companyId!,...scope(actor)}}}});
 if(!row)throw new AuthorizationError();
 const bytes=await privateStorage().get(row.storageKey);
 if(bytes.length!==row.sizeBytes||createHash("sha256").update(bytes).digest("hex")!==row.contentHash)throw new QuotationAttachmentError("QUOTATION_ATTACHMENT_CORRUPT");
 return {data:bytes,name:row.displayName,mimeType:row.mimeType};
}
export async function removeQuotationAttachmentForActor(actor:QuotationActor,documentId:string,revisionNumber:number,id:string){
 await authorize(actor,true);z.string().uuid().parse(id);z.string().uuid().parse(documentId);z.number().int().min(0).parse(revisionNumber);
 const key=await db.$transaction(async tx=>{
  await lock(tx,actor,documentId);const revision=await current(tx,actor,documentId,revisionNumber,true);
  const row=await tx.quotationAttachment.findFirst({where:{id,companyId:actor.companyId!,revisionId:revision.id}});
  if(!row)return null;
  await tx.quotationAttachment.delete({where:{id:row.id}});
  await tx.quotationAuditEvent.create({data:{companyId:actor.companyId!,documentId,actorId:actor.id,eventType:"DRAFT_UPDATED",revisionNumber,note:`Attachment removed: ${row.id}`}});
  return row.storageKey;
 });
 // Metadata removal is already committed. Storage failures leave an orphan,
 // never a broken historical reference. Retried removals remain harmless.
 if(key)await discardUnreferenced(actor.companyId!,key).catch(()=>undefined);
}
export async function copyQuotationAttachmentsInTx(tx:Prisma.TransactionClient,companyId:string,from:string,to:string){
 const rows=await tx.quotationAttachment.findMany({where:{companyId,revisionId:from}});
 if(rows.length)await tx.quotationAttachment.createMany({data:rows.map(row=>({...row,id:randomUUID(),requestKey:randomUUID(),revisionId:to}))});
}
