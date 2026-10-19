import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
const url=process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("Isolated local *_ci database required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/checkpoint_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {setPrivateStorageForTests} from "@/lib/storage";
import {createQuotationForActor,createQuotationRevisionForActor,getQuotationForActor,getCustomerQuotationForActor,createQuotationShareForActor,getPublicQuotation,transitionQuotationForActor,updateQuotationDraftForActor,type QuotationActor} from "./service";
import {downloadQuotationAttachmentForActor,listQuotationAttachmentsForActor,removeQuotationAttachmentForActor,uploadQuotationAttachmentForActor} from "./attachments";
const companyId=randomUUID(),foreignId=randomUUID(),branchId=randomUUID(),userId=randomUUID(),customerId=randomUUID();
const objects=new Map<string,Buffer>(),put=vi.fn(async(key:string,bytes:Buffer)=>{objects.set(key,Buffer.from(bytes))}),remove=vi.fn(async(key:string)=>{objects.delete(key)});
let actor:QuotationActor;
const input={branchId,customerId,documentType:"QUOTATION",issueDate:"2026-10-19",lines:[{lineType:"CUSTOM",itemName:"Work",quantity:"1",rate:"10"}]};
const pdf=(name="plan.pdf",text="%PDF-1.7\nfixture")=>new File([text],name,{type:"application/pdf"});
const request=(id:string)=>({documentId:id,revisionNumber:0,requestKey:randomUUID()});
describe.skipIf(!url)("A082 private revision attachments",()=>{
 beforeAll(async()=>{
  for(const id of [companyId,foreignId])await client.company.create({data:{id,name:"Attachment fixture",slug:`attachment-${id}`,productEdition:"SALESPUNCH360_ACCOUNT"}});
  await client.branch.create({data:{id:branchId,companyId,name:"Attachment branch",code:"PRIMARY"}});
  await client.customer.create({data:{id:customerId,companyId,branchId,name:"Attachment party",isAccountCustomer:true}});
  const user=await client.user.create({data:{id:userId,companyId,name:"Attachment admin",email:`${userId}@example.test`,passwordHash:"fixture-only",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",accountAccessActive:true}});
  actor={...user,companyId,branchAccessScope:"ALL_BRANCHES",branchIds:[]};
  setPrivateStorageForTests({put,get:async key=>{const bytes=objects.get(key);if(!bytes)throw new Error("missing file");return bytes},delete:remove});
 });
 afterAll(async()=>{
  setPrivateStorageForTests(undefined);
  await client.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
   await tx.quotationShare.deleteMany({where:{companyId}});await tx.quotationAttachment.deleteMany({where:{companyId}});await tx.quotationAuditEvent.deleteMany({where:{companyId}});await tx.quotationPaymentSchedule.deleteMany({where:{companyId}});await tx.quotationAdjustment.deleteMany({where:{companyId}});await tx.quotationLine.deleteMany({where:{companyId}});await tx.quotationRevision.deleteMany({where:{companyId}});await tx.quotationDocument.deleteMany({where:{companyId}});
  });
  await client.numberingSeries.deleteMany({where:{companyId}});await client.customer.deleteMany({where:{companyId}});await client.user.deleteMany({where:{companyId}});await client.branch.deleteMany({where:{companyId}});await client.company.deleteMany({where:{id:{in:[companyId,foreignId]}}});await client.$disconnect();
 });
 it("serializes retries once, rejects changed intent and returns only safe metadata",async()=>{
  const document=await createQuotationForActor(actor,input),raw=request(document.id),file=pdf("../private-plan.pdf");put.mockClear();
  const [first,replay]=await Promise.all([uploadQuotationAttachmentForActor(actor,raw,file),uploadQuotationAttachmentForActor(actor,raw,file)]);
  expect(first.id).toBe(replay.id);expect(put).toHaveBeenCalledTimes(1);expect(first.displayName).toBe("private-plan.pdf");
  expect(JSON.stringify(first)).not.toMatch(/storageKey|requestHash|contentHash|companyId|revisionId/);
  await expect(uploadQuotationAttachmentForActor(actor,raw,pdf("other.pdf"))).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
  expect((await downloadQuotationAttachmentForActor(actor,first.id)).data.toString()).toBe("%PDF-1.7\nfixture");
  expect(await listQuotationAttachmentsForActor(actor,document.id,0)).toHaveLength(1);
  const stored=await client.quotationAttachment.findUniqueOrThrow({where:{id:first.id}}),original=objects.get(stored.storageKey)!;objects.set(stored.storageKey,Buffer.from("wrong bytes"));
  try{await expect(downloadQuotationAttachmentForActor(actor,first.id)).rejects.toThrow("QUOTATION_ATTACHMENT_CORRUPT");}finally{objects.set(stored.storageKey,original)}
 });
 it("preserves attachment IDs through draft replacement and protects copied issued history",async()=>{
  const document=await createQuotationForActor(actor,input),raw=request(document.id),file=await uploadQuotationAttachmentForActor(actor,raw,pdf());
  await client.customer.update({where:{id:customerId},data:{isActive:false}});
  try{await expect(updateQuotationDraftForActor(actor,document.id,{...input,notes:"Must roll back"})).rejects.toThrow("INVALID_CUSTOMER");}finally{await client.customer.update({where:{id:customerId},data:{isActive:true}})}
  expect((await listQuotationAttachmentsForActor(actor,document.id,0))[0].id).toBe(file.id);
  await updateQuotationDraftForActor(actor,document.id,{...input,notes:"Edited"});expect((await listQuotationAttachmentsForActor(actor,document.id,0))[0].id).toBe(file.id);
  expect((await uploadQuotationAttachmentForActor(actor,raw,pdf())).id).toBe(file.id);
  await transitionQuotationForActor(actor,document.id,"PENDING_APPROVAL");await transitionQuotationForActor(actor,document.id,"APPROVED");
  const customer=await getCustomerQuotationForActor(actor,document.id),share=await createQuotationShareForActor(actor,document.id),publicDto=await getPublicQuotation(share);
  for(const dto of [customer,publicDto]){expect(dto).not.toHaveProperty("attachments");expect(JSON.stringify(dto)).not.toMatch(/storageKey|requestHash|contentHash/);expect(JSON.stringify(dto)).not.toContain(file.id);expect(JSON.stringify(dto)).not.toContain("plan.pdf");}
  await expect(uploadQuotationAttachmentForActor(actor,{...raw,requestKey:randomUUID()},pdf())).rejects.toThrow("DRAFT_NOT_EDITABLE");
  await expect(client.quotationAttachment.update({where:{id:file.id},data:{displayName:"Changed"}})).rejects.toThrow("ISSUED_QUOTATION_CHILD_IMMUTABLE");
  await expect(client.quotationAttachment.delete({where:{id:file.id}})).rejects.toThrow("ISSUED_QUOTATION_CHILD_IMMUTABLE");
  await createQuotationRevisionForActor(actor,document.id,input);const copies=await listQuotationAttachmentsForActor(actor,document.id,1);expect(copies).toHaveLength(1);expect(copies[0].id).not.toBe(file.id);
  await expect(uploadQuotationAttachmentForActor(actor,raw,pdf())).rejects.toThrow("QUOTATION_REVISION_CHANGED");
  await removeQuotationAttachmentForActor(actor,document.id,1,copies[0].id);
  expect((await downloadQuotationAttachmentForActor(actor,file.id)).data.toString()).toContain("%PDF-");
  expect((await getQuotationForActor(actor,document.id)).revisions[0].revisionNumber).toBe(1);
 });
 it("scopes reads and writes by company, assigned branch and permission before storage",async()=>{
  const document=await createQuotationForActor(actor,input),raw=request(document.id),file=await uploadQuotationAttachmentForActor(actor,raw,pdf());put.mockClear();
  for(const denied of [{...actor,companyId:foreignId},{...actor,branchAccessScope:"SELECTED_BRANCHES" as const,branchIds:[]},{...actor,accountRole:null}]){
   await expect(downloadQuotationAttachmentForActor(denied,file.id)).rejects.toThrow();
   await expect(listQuotationAttachmentsForActor(denied,document.id,0)).rejects.toThrow();
   await expect(uploadQuotationAttachmentForActor(denied,{...raw,requestKey:randomUUID()},pdf())).rejects.toThrow();
  }
  expect(put).not.toHaveBeenCalled();
  await client.company.update({where:{id:companyId},data:{productEdition:"SALESPUNCH360"}});
  try{await expect(downloadQuotationAttachmentForActor(actor,file.id)).rejects.toThrow("MODULE_DISABLED:QUOTATIONS_BOQ");}finally{await client.company.update({where:{id:companyId},data:{productEdition:"SALESPUNCH360_ACCOUNT"}})}
 });
 it("rejects invalid MIME, signatures and oversized bytes without adding records",async()=>{
  const document=await createQuotationForActor(actor,input);put.mockClear();
  for(const file of [pdf("empty.pdf",""),pdf("bad.pdf","not a PDF"),new File(["<svg/>"],"a.svg",{type:"image/svg+xml"}),new File([new Uint8Array(10*1024*1024+1)],"big.pdf",{type:"application/pdf"})])await expect(uploadQuotationAttachmentForActor(actor,request(document.id),file)).rejects.toThrow("INVALID_QUOTATION_ATTACHMENT");
  expect(put).not.toHaveBeenCalled();expect(await listQuotationAttachmentsForActor(actor,document.id,0)).toEqual([]);
 });
 it("removes an unshared draft attachment idempotently without journal writes",async()=>{
  const document=await createQuotationForActor(actor,input),file=await uploadQuotationAttachmentForActor(actor,request(document.id),pdf()),row=await client.quotationAttachment.findUniqueOrThrow({where:{id:file.id}});
  await removeQuotationAttachmentForActor(actor,document.id,0,file.id);await removeQuotationAttachmentForActor(actor,document.id,0,file.id);
  expect(objects.has(row.storageKey)).toBe(false);await expect(downloadQuotationAttachmentForActor(actor,file.id)).rejects.toThrow();
  expect(await client.journalEntry.count({where:{companyId}})).toBe(0);
 });
 it("rolls back metadata and cleans only unreferenced bytes when audit insertion fails",async()=>{
  const document=await createQuotationForActor(actor,input),raw=request(document.id),before=objects.size;
  const trigger=`attachment_reject_${randomUUID().replaceAll("-","")}`;
  await client.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger AS $$ BEGIN IF NEW."companyId"='${companyId}'::uuid AND NEW.note LIKE 'Attachment added:%' THEN RAISE EXCEPTION 'ATTACHMENT_AUDIT_FAILURE';END IF; RETURN NEW;END;$$ LANGUAGE plpgsql`);
  await client.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON quotation_audit_events FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
  try{await expect(uploadQuotationAttachmentForActor(actor,raw,pdf())).rejects.toThrow("ATTACHMENT_AUDIT_FAILURE");}finally{await client.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON quotation_audit_events`);await client.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`)}
  expect(await listQuotationAttachmentsForActor(actor,document.id,0)).toEqual([]);expect(objects.size).toBe(before);
 });
 it("does not persist metadata or audit an unavailable storage write",async()=>{
  const document=await createQuotationForActor(actor,input),before=await client.quotationAuditEvent.count({where:{documentId:document.id}});
  put.mockRejectedValueOnce(new Error("Storage unavailable"));
  await expect(uploadQuotationAttachmentForActor(actor,request(document.id),pdf())).rejects.toThrow("Storage unavailable");
  expect(await listQuotationAttachmentsForActor(actor,document.id,0)).toEqual([]);expect(await client.quotationAuditEvent.count({where:{documentId:document.id}})).toBe(before);
 });
});
