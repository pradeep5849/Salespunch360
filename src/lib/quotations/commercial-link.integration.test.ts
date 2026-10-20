import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
const url=process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("Isolated local *_ci database required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/checkpoint_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {DEFAULT_LEDGER_ACCOUNTS} from "@/lib/accounting/default-accounts";
import {submitSaleForActor} from "@/lib/account/sale-submit";
import {createCommercialDocumentForActor,confirmSalesOrderForActor} from "@/lib/account/commercial";
import {createQuotationForActor,createQuotationRevisionForActor,transitionQuotationForActor,listQuotationsForActor,getQuotationForActor,createQuotationShareForActor} from "./service";
import type {ProjectActor} from "@/lib/account/projects";
const fixture=()=>({companyId:randomUUID(),branchId:randomUUID(),customerId:randomUUID(),userId:randomUUID()});
const own=fixture(),foreign=fixture(),fixtures=[own,foreign];
const actor=(f=own)=>({id:f.userId,name:"Conversion admin",email:`${f.userId}@example.test`,companyId:f.companyId,role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",accountAccessActive:true,isActive:true,salesAccessActive:false,salesRole:null,managerType:null,branchAccessScope:"ALL_BRANCHES",branchIds:[]} as ProjectActor);
const quoteInput=(f=own)=>({branchId:f.branchId,customerId:f.customerId,documentType:"ESTIMATE",issueDate:"2026-10-20",lines:[{lineType:"CUSTOM",itemName:"Approved work",quantity:"1",rate:"100",taxRate:"0"}]});
async function approved(f=own){const q=await createQuotationForActor(actor(f),quoteInput(f));await transitionQuotationForActor(actor(f),q.id,"PENDING_APPROVAL");await transitionQuotationForActor(actor(f),q.id,"APPROVED");return {id:q.id,revision:await client.quotationRevision.findFirstOrThrow({where:{companyId:f.companyId,documentId:q.id},orderBy:{revisionNumber:"desc"}})}}
const target=(revisionId:string,type="SALES_INVOICE")=>({type,idempotencyKey:randomUUID(),branchId:own.branchId,partyId:own.customerId,sourceQuotationRevisionId:revisionId,issueDate:"2026-10-20",lines:[{lineType:"CUSTOM",itemName:"Approved work",quantity:"1",rate:"100",taxRate:"0"}]});
const source=(id:string)=>client.quotationDocument.findUniqueOrThrow({where:{id}});
describe.skipIf(!url)("A080/A083 actual quotation conversion commit boundary",()=>{
 beforeAll(async()=>{
  for(const f of fixtures){
   await client.company.create({data:{id:f.companyId,name:"Conversion fixture",slug:`conversion-${f.companyId}`,productEdition:"SALESPUNCH360_ACCOUNT"}});
   await client.branch.create({data:{id:f.branchId,companyId:f.companyId,name:"Main",code:"MAIN",isPrimary:true}});
   await client.user.create({data:{id:f.userId,companyId:f.companyId,name:"Conversion admin",email:`${f.userId}@example.test`,passwordHash:"fixture-only",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",accountAccessActive:true}});
   await client.customer.create({data:{id:f.customerId,companyId:f.companyId,branchId:f.branchId,name:"Conversion party",isAccountCustomer:true}});
   await client.accountSettings.create({data:{companyId:f.companyId,enabledModules:[]}});
   await client.financialYear.create({data:{companyId:f.companyId,name:"2026-27",startDate:new Date("2026-04-01"),endDate:new Date("2027-03-31")}});
   await client.ledgerAccount.createMany({data:DEFAULT_LEDGER_ACCOUNTS.map(row=>({...row,companyId:f.companyId}))});
  }
 });
 afterAll(async()=>{
  for(const {companyId} of fixtures)await client.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
   await tx.commercialAuditEvent.deleteMany({where:{companyId}});await tx.accountOperationalAudit.deleteMany({where:{companyId}});await tx.accountingAuditEvent.deleteMany({where:{companyId}});
   await tx.settlementAllocation.deleteMany({where:{companyId}});await tx.accountSettlement.deleteMany({where:{companyId}});await tx.commercialDocumentLine.deleteMany({where:{companyId}});await tx.commercialDocument.deleteMany({where:{companyId}});
   await tx.quotationShare.deleteMany({where:{companyId}});await tx.quotationAuditEvent.deleteMany({where:{companyId}});await tx.quotationPaymentSchedule.deleteMany({where:{companyId}});await tx.quotationAdjustment.deleteMany({where:{companyId}});await tx.quotationLine.deleteMany({where:{companyId}});await tx.quotationRevision.deleteMany({where:{companyId}});await tx.quotationDocument.deleteMany({where:{companyId}});
   await tx.journalLine.deleteMany({where:{companyId}});await tx.journalEntry.deleteMany({where:{companyId}});await tx.numberingSeries.deleteMany({where:{companyId}});await tx.ledgerAccount.deleteMany({where:{companyId}});await tx.financialYear.deleteMany({where:{companyId}});await tx.accountSettings.deleteMany({where:{companyId}});await tx.customer.deleteMany({where:{companyId}});await tx.user.deleteMany({where:{companyId}});await tx.branch.deleteMany({where:{companyId}});await tx.company.delete({where:{id:companyId}});
  });await client.$disconnect();
 });
 it("commits Sale posting, original revision linkage and source closure once under concurrent identical retry",async()=>{
  const q=await approved(),raw=target(q.revision.id),[a,b]=await Promise.all([submitSaleForActor(actor(),raw),submitSaleForActor(actor(),raw)]);
  expect(a.id).toBe(b.id);expect((await source(q.id)).convertedCommercialDocumentId).toBe(a.id);expect((await source(q.id)).convertedAt).toBeInstanceOf(Date);
  const saved=await client.commercialDocument.findUniqueOrThrow({where:{id:a.id}});expect(saved.status).toBe("POSTED");expect(saved.sourceQuotationRevisionId).toBe(q.revision.id);
  expect(await client.journalEntry.count({where:{companyId:own.companyId,sourceId:a.id,status:"POSTED"}})).toBe(1);
  const sums=await client.journalLine.aggregate({where:{companyId:own.companyId,journalEntryId:saved.journalEntryId!},_sum:{debit:true,credit:true}});expect(sums._sum.debit?.toFixed(2)).toBe("100.00");expect(sums._sum.credit?.toFixed(2)).toBe("100.00");
  expect(await client.quotationAuditEvent.count({where:{companyId:own.companyId,documentId:q.id,eventType:"CONVERTED"}})).toBe(1);
  expect((await listQuotationsForActor(actor(),{status:"OPEN"})).map(row=>row.id)).not.toContain(q.id);
  expect((await listQuotationsForActor(actor(),{status:"CLOSED",q:(await source(q.id)).documentNumber})).map(row=>row.id)).toEqual([q.id]);
  const detail=await getQuotationForActor(actor(),q.id);expect(detail.capabilities).toMatchObject({canRevise:false,canLifecycle:false,canConvertToSale:false,canConvertToSalesOrder:false});
  await expect(createQuotationRevisionForActor(actor(),q.id,quoteInput())).rejects.toThrow("REVISION_NOT_ALLOWED");
  await expect(transitionQuotationForActor(actor(),q.id,"SENT")).rejects.toThrow("QUOTATION_ALREADY_CONVERTED");
  expect(await createQuotationShareForActor(actor(),q.id)).toBeTruthy();expect((await source(q.id)).status).toBe("APPROVED");
 });
 it("allows only one actual conversion for competing new Sale requests",async()=>{
  const q=await approved(),results=await Promise.allSettled([submitSaleForActor(actor(),target(q.revision.id)),submitSaleForActor(actor(),target(q.revision.id))]);
  expect(results.filter(x=>x.status==="fulfilled")).toHaveLength(1);expect(results.filter(x=>x.status==="rejected")).toHaveLength(1);
  expect(await client.commercialDocument.count({where:{companyId:own.companyId,sourceQuotationRevisionId:q.revision.id}})).toBe(1);
 });
 it("rolls back source closure and all Sale writes if the later receipt fails",async()=>{
  const q=await approved(),raw=target(q.revision.id),before=await client.journalEntry.count({where:{companyId:own.companyId}});
  await expect(submitSaleForActor(actor(),raw,{receivedAmount:"100",paymentType:"BANK",moneyAccountId:randomUUID()})).rejects.toThrow();
  expect((await source(q.id)).convertedCommercialDocumentId).toBeNull();expect(await client.commercialDocument.count({where:{companyId:own.companyId,sourceQuotationRevisionId:q.revision.id}})).toBe(0);
  expect(await client.journalEntry.count({where:{companyId:own.companyId}})).toBe(before);expect(await client.quotationAuditEvent.count({where:{companyId:own.companyId,documentId:q.id,eventType:"CONVERTED"}})).toBe(0);
 });
 it("keeps an order draft open and closes only on idempotent confirmation without a ledger write",async()=>{
  const q=await approved(),order=await createCommercialDocumentForActor(actor(),target(q.revision.id,"SALES_ORDER")),before=await client.journalEntry.count({where:{companyId:own.companyId}});
  expect(order.status).toBe("DRAFT");expect((await source(q.id)).convertedAt).toBeNull();
  const [a,b]=await Promise.all([confirmSalesOrderForActor(actor(),{documentId:order.id}),confirmSalesOrderForActor(actor(),{documentId:order.id})]);
  expect(a.id).toBe(b.id);expect(a.status).toBe("POSTED");expect((await source(q.id)).convertedCommercialDocumentId).toBe(order.id);
  expect(await client.journalEntry.count({where:{companyId:own.companyId}})).toBe(before);expect(await client.accountOperationalAudit.count({where:{companyId:own.companyId,eventType:"SALES_ORDER_CONFIRMED",entityId:order.id}})).toBe(1);
 });
 it("rejects a stale source revision when confirming an earlier order draft",async()=>{
  const q=await approved(),order=await createCommercialDocumentForActor(actor(),target(q.revision.id,"SALES_ORDER"));await createQuotationRevisionForActor(actor(),q.id,quoteInput());
  await expect(confirmSalesOrderForActor(actor(),{documentId:order.id})).rejects.toThrow("QUOTATION_REVISION_CHANGED");expect((await source(q.id)).convertedAt).toBeNull();expect((await client.commercialDocument.findUniqueOrThrow({where:{id:order.id}})).status).toBe("DRAFT");
 });
 it("denies unapproved, foreign, unassigned-branch and denied-role sources without a target",async()=>{
  const draft=await createQuotationForActor(actor(),quoteInput()),revision=await client.quotationRevision.findFirstOrThrow({where:{documentId:draft.id}});
  await expect(submitSaleForActor(actor(),target(revision.id))).rejects.toThrow("QUOTATION_APPROVAL_REQUIRED");
  const other=await approved(foreign);await expect(submitSaleForActor(actor(),target(other.revision.id))).rejects.toThrow("INVALID_QUOTATION_CONVERSION_SOURCE");
  const q=await approved();await expect(submitSaleForActor({...actor(),branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},target(q.revision.id))).rejects.toThrow();
  await expect(submitSaleForActor({...actor(),accountRole:"DATA_ENTRY"},target(q.revision.id))).rejects.toThrow();expect((await source(q.id)).convertedAt).toBeNull();
  for(const id of [q.revision.id,other.revision.id,revision.id])expect(await client.commercialDocument.count({where:{companyId:own.companyId,sourceQuotationRevisionId:id}})).toBe(0);
 });
 it("rejects missing retry identity and direct closure bypass while preserving the order draft",async()=>{
  const q=await approved(),raw={...target(q.revision.id),idempotencyKey:undefined};await expect(createCommercialDocumentForActor(actor(),raw)).rejects.toThrow("QUOTATION_CONVERSION_KEY_REQUIRED");
  const order=await createCommercialDocumentForActor(actor(),target(q.revision.id,"SALES_ORDER"));
  await expect(client.commercialDocument.update({where:{id:order.id},data:{status:"POSTED"}})).rejects.toThrow("QUOTATION_CONVERSION_CLOSURE_REQUIRED");
  expect((await client.commercialDocument.findUniqueOrThrow({where:{id:order.id}})).status).toBe("DRAFT");expect((await source(q.id)).convertedAt).toBeNull();
 });
 it("keeps successful conversion history and target source identity immutable",async()=>{
  const q=await approved(),sale=await submitSaleForActor(actor(),target(q.revision.id));
  await expect(client.commercialDocument.update({where:{id:sale.id},data:{sourceQuotationRevisionId:null}})).rejects.toThrow("FINANCIAL_HISTORY_IMMUTABLE");
  await expect(client.quotationDocument.update({where:{id:q.id},data:{convertedCommercialDocumentId:null,convertedAt:null}})).rejects.toThrow("QUOTATION_CONVERSION_HISTORY_IMMUTABLE");
  const other=await approved(),order=await createCommercialDocumentForActor(actor(),target(other.revision.id,"SALES_ORDER"));
  await expect(client.commercialDocument.update({where:{id:order.id},data:{sourceQuotationRevisionId:null}})).rejects.toThrow("QUOTATION_CONVERSION_SOURCE_IMMUTABLE");
 });
});
