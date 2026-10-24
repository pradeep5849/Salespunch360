import {createHash} from "node:crypto";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {retrySerializable} from "./transaction-retry";
import {loanCreationFingerprint} from "./loan-fingerprint";
import type {ProjectActor} from "./projects";
const blank=(v:unknown)=>typeof v==="string"&&v.trim()===""?null:v;
const text=(max:number)=>z.preprocess(blank,z.string().trim().max(max).nullable().optional());
export const loanMetadataInput=z.object({
 requestKey:z.string().guid(),expectedVersion:z.coerce.number().int().min(0).max(2147483646),
 displayName:text(240),loanAccountNumber:text(160),description:text(2000),
 durationMonths:z.preprocess(blank,z.coerce.number().int().min(1).max(1200).nullable().optional()),
}).strict();
export async function editLoanMetadataForActor(actor:ProjectActor,id:string,raw:unknown){
 if(!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_LOAN_ADMIN"))throw new AuthorizationError();
 z.string().guid().parse(id);const d=loanMetadataInput.parse(raw);const {requestKey,expectedVersion,...patch}=d;
 return retrySerializable(()=>db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM loans WHERE id=${id}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const before=await tx.loan.findFirst({where:{id,companyId:actor.companyId}});
  if(!before||actor.branchAccessScope==="SELECTED_BRANCHES"&&!actor.branchIds?.includes(before.branchId))throw new AuthorizationError();
  const hash=createHash("sha256").update(JSON.stringify({action:"EDIT_METADATA",loanId:before.id,expectedVersion,patch})).digest("hex");
  const prior=await tx.loanOperation.findFirst({where:{companyId:actor.companyId,requestKey}});
  if(prior){if(prior.loanId!==before.id||prior.requestHash!==hash)throw new Error("IDEMPOTENCY_CONFLICT");return before;}
  if(before.version!==expectedVersion)throw new Error("LOAN_CHANGED");
  const after=await tx.loan.update({where:{id:before.id},data:{...patch,version:{increment:1},creationRequestHash:before.creationRequestHash??loanCreationFingerprint(before)}});
  const snapshot=(row:typeof before)=>({displayName:row.displayName,loanAccountNumber:row.loanAccountNumber,description:row.description,durationMonths:row.durationMonths});
  const metadata={before:snapshot(before),after:snapshot(after)};
  await tx.loanOperation.create({data:{companyId:actor.companyId,loanId:before.id,action:"EDIT_METADATA",requestKey,requestHash:hash,expectedVersion,resultingVersion:after.version,createdById:actor.id,metadata}});
  await tx.accountOperationalAudit.create({data:{companyId:actor.companyId,actorUserId:actor.id,eventType:"LOAN_METADATA_EDITED",entityType:"LOAN",entityId:before.id,metadata:{...metadata,requestKey}}});
  return after;
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}),3,["companyId","requestKey"]);
}

export const loanTopUpInput=z.object({
 requestKey:z.string().guid(),expectedVersion:z.coerce.number().int().min(0).max(2147483646),
 amount:z.string().regex(/^\d{1,16}(\.\d{1,2})?$/).refine(v=>new Prisma.Decimal(v).gt(0)),
 operationDate:z.coerce.date(),moneyAccountId:z.string().guid(),description:text(2000),
}).strict();
/** Additional borrowing has its own immutable receipt; original principal stays intact. */
export async function topUpLoanForActor(actor:ProjectActor,id:string,raw:unknown){
 if(!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_LOAN_ADMIN"))throw new AuthorizationError();
 z.string().guid().parse(id);const d=loanTopUpInput.parse(raw);
 const hash=createHash("sha256").update(JSON.stringify({action:"TOP_UP",loanId:id,expectedVersion:d.expectedVersion,amount:new Prisma.Decimal(d.amount).toFixed(2),operationDate:d.operationDate.toISOString().slice(0,10),moneyAccountId:d.moneyAccountId,description:d.description??null})).digest("hex");
 return retrySerializable(()=>db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM loans WHERE id=${id}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const loan=await tx.loan.findFirst({where:{id,companyId:actor.companyId}});
  if(!loan||actor.branchAccessScope==="SELECTED_BRANCHES"&&!actor.branchIds?.includes(loan.branchId))throw new AuthorizationError();
  const prior=await tx.loanOperation.findFirst({where:{companyId:actor.companyId,requestKey:d.requestKey}});
  if(prior){if(prior.loanId!==id||prior.requestHash!==hash)throw new Error("IDEMPOTENCY_CONFLICT");return prior;}
  if(loan.version!==d.expectedVersion)throw new Error("LOAN_CHANGED");
  if(await tx.loan.count({where:{companyId:actor.companyId,branchId:loan.branchId,liabilityLedgerId:loan.liabilityLedgerId}})>1)throw new Error("LOAN_BALANCE_AMBIGUOUS");
  if(loan.archivedAt||loan.status==="CANCELLED"||!loan.receivedJournalId)throw new Error("INVALID_LOAN");
  if(d.operationDate<loan.startDate)throw new Error("INVALID_LOAN_DATE");
  const money=await tx.moneyAccount.findFirst({where:{id:d.moneyAccountId,companyId:actor.companyId,isActive:true,OR:[{branchId:null},{branchId:loan.branchId}]}});
  if(!money)throw new Error("INVALID_MONEY_ACCOUNT");
  const fy=await tx.financialYear.findFirst({where:{companyId:actor.companyId,isActive:true,startDate:{lte:d.operationDate},endDate:{gte:d.operationDate}}});
  if(!fy)throw new Error("INVALID_FINANCIAL_YEAR");
  const {postJournalInTx}=await import("@/lib/accounting/service");const operationId=crypto.randomUUID();
  const journal=await postJournalInTx(tx,actor,{financialYearId:fy.id,branchId:loan.branchId,entryDate:d.operationDate,narration:d.description??undefined,sourceType:"LOAN_TOP_UP",sourceId:operationId,postingPurpose:"PRIMARY",lines:[{ledgerAccountId:money.ledgerAccountId,debit:d.amount,credit:"0"},{ledgerAccountId:loan.liabilityLedgerId,debit:"0",credit:d.amount}]});
  const after=await tx.loan.update({where:{id},data:{version:{increment:1},status:"ACTIVE"}});
  const operation=await tx.loanOperation.create({data:{id:operationId,companyId:actor.companyId,loanId:id,action:"TOP_UP",requestKey:d.requestKey,requestHash:hash,expectedVersion:d.expectedVersion,resultingVersion:after.version,amount:new Prisma.Decimal(d.amount),operationDate:d.operationDate,moneyAccountId:money.id,journalEntryId:journal.id,createdById:actor.id,metadata:{description:d.description??null}}});
  await tx.accountOperationalAudit.create({data:{companyId:actor.companyId,actorUserId:actor.id,eventType:"LOAN_TOP_UP_POSTED",entityType:"LOAN",entityId:id,metadata:{operationId,journalEntryId:journal.id,requestKey:d.requestKey}}});return operation;
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}),3,["companyId","requestKey"]);
}

export const loanLifecycleInput=z.object({requestKey:z.string().guid(),expectedVersion:z.coerce.number().int().min(0).max(2147483646),action:z.enum(["CANCEL","ARCHIVE","RESTORE"]),operationDate:z.coerce.date(),reason:z.string().trim().min(3).max(1000)}).strict();
export async function changeLoanLifecycleForActor(actor:ProjectActor,id:string,raw:unknown){
 if(!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_LOAN_ADMIN"))throw new AuthorizationError();
 z.string().guid().parse(id);const d=loanLifecycleInput.parse(raw);const hash=createHash("sha256").update(JSON.stringify({...d,operationDate:d.operationDate.toISOString().slice(0,10),loanId:id})).digest("hex");
 return retrySerializable(()=>db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM loans WHERE id=${id}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const loan=await tx.loan.findFirst({where:{id,companyId:actor.companyId}});
  if(!loan||actor.branchAccessScope==="SELECTED_BRANCHES"&&!actor.branchIds?.includes(loan.branchId))throw new AuthorizationError();
  const prior=await tx.loanOperation.findFirst({where:{companyId:actor.companyId,requestKey:d.requestKey}});
  if(prior){if(prior.loanId!==id||prior.requestHash!==hash)throw new Error("IDEMPOTENCY_CONFLICT");return prior;}
  if(loan.version!==d.expectedVersion)throw new Error("LOAN_CHANGED");
  if(await tx.loan.count({where:{companyId:actor.companyId,branchId:loan.branchId,liabilityLedgerId:loan.liabilityLedgerId}})>1)throw new Error("LOAN_BALANCE_AMBIGUOUS");
  const balances=await tx.journalLine.aggregate({where:{companyId:actor.companyId,ledgerAccountId:loan.liabilityLedgerId,journalEntry:{companyId:actor.companyId,branchId:loan.branchId,status:{in:["POSTED","REVERSED"]}}},_sum:{debit:true,credit:true}});
  const outstanding=new Prisma.Decimal(balances._sum.credit??0).sub(balances._sum.debit??0);
  let journalEntryId:string|undefined;
  if(d.action==="CANCEL"){
   if(loan.archivedAt||loan.status!=="ACTIVE"||!loan.receivedJournalId)throw new Error("INVALID_LOAN");
   if(d.operationDate<loan.startDate)throw new Error("INVALID_LOAN_DATE");
   const [payments,topups]=await Promise.all([tx.loanPayment.count({where:{companyId:actor.companyId,loanId:id}}),tx.loanOperation.count({where:{companyId:actor.companyId,loanId:id,action:{in:["TOP_UP","OPENING_FEE"]}}})]);
   if(payments||topups||!outstanding.eq(loan.principal))throw new Error("LOAN_HAS_FINANCIAL_ACTIVITY");
   const receiptAccount=await tx.moneyAccount.findFirst({where:{id:loan.moneyAccountId,companyId:actor.companyId}});
   if(!receiptAccount)throw new Error("INVALID_MONEY_ACCOUNT");
   const funds=await tx.journalLine.aggregate({where:{companyId:actor.companyId,ledgerAccountId:receiptAccount.ledgerAccountId,journalEntry:{companyId:actor.companyId,...(receiptAccount.branchId?{branchId:receiptAccount.branchId}:{}),status:{in:["POSTED","REVERSED"]}}},_sum:{debit:true,credit:true}});
   if(new Prisma.Decimal(funds._sum.debit??0).sub(funds._sum.credit??0).lt(loan.principal))throw new Error("INSUFFICIENT_FUNDS");
   const {reverseJournalInTx}=await import("@/lib/accounting/service");const reversal=await reverseJournalInTx(tx,actor,{journalEntryId:loan.receivedJournalId,entryDate:d.operationDate,reason:d.reason},{loanReceiptId:id});journalEntryId=reversal.id;
  }else if(d.action==="ARCHIVE"){
   if(loan.archivedAt||!loan.receivedJournalId||!outstanding.isZero())throw new Error("LOAN_ARCHIVE_REQUIRES_ZERO_BALANCE");
  }else if(!loan.archivedAt)throw new Error("LOAN_NOT_ARCHIVED");
  const after=await tx.loan.update({where:{id},data:{version:{increment:1},...(d.action==="CANCEL"?{status:"CANCELLED" as const}:d.action==="ARCHIVE"?{archivedAt:new Date()}:{archivedAt:null})}});
  const operation=await tx.loanOperation.create({data:{companyId:actor.companyId,loanId:id,action:d.action,requestKey:d.requestKey,requestHash:hash,expectedVersion:d.expectedVersion,resultingVersion:after.version,operationDate:d.operationDate,journalEntryId,createdById:actor.id,metadata:{reason:d.reason,outstandingBefore:outstanding.toFixed(2)}}});
  await tx.accountOperationalAudit.create({data:{companyId:actor.companyId,actorUserId:actor.id,eventType:`LOAN_${d.action}`,entityType:"LOAN",entityId:id,metadata:{operationId:operation.id,requestKey:d.requestKey,reason:d.reason}}});return operation;
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}),3,["companyId","requestKey"]);
}
