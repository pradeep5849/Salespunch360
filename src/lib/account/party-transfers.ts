import {assertSafeObjectKey} from "@/lib/storage/types";
import {privateStorage} from "@/lib/storage";
import {preparePartyTransferPhoto} from "./party-transfer-photo";
import {createHash} from "node:crypto";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {assertOperationalWrite} from "@/lib/billing/entitlement";
import {postJournalInTx,reverseJournalInTx} from "@/lib/accounting/service";
import {partyTransferInput,partyTransferAmounts} from "./party-transfer-policy";
import {createExpenseForActor,reverseExpenseForActor} from "./expenses";
import {allocateDocumentNumberInTx} from "./numbering";
import {retrySerializable} from "./transaction-retry";
import type {ProjectActor} from "./projects";
const D=Prisma.Decimal;
import {partyTransferSnapshot} from "./party-transfer-snapshot";
export {partyTransferSnapshot} from "./party-transfer-snapshot";
async function access(a:ProjectActor,write=false){
 if(!a.companyId||!canUsePermission(a,"SALESPUNCH360_ACCOUNT",write?"ACCOUNT_MONEY_ENTRY":"ACCOUNT_MONEY_VIEW"))throw new AuthorizationError();
 const company=await db.company.findUnique({where:{id:a.companyId},select:{productEdition:true}});
 if(!company||!["SALESPUNCH360_ACCOUNT","SALESPUNCH360_PLUS"].includes(company.productEdition))throw new AuthorizationError();
 if(write){if(!canUsePermission(a,"SALESPUNCH360_ACCOUNT","ACCOUNT_JOURNAL_POST"))throw new AuthorizationError();await assertOperationalWrite(a.companyId)}
}
function branch(a:ProjectActor,id:string){if(a.branchAccessScope==="SELECTED_BRANCHES"&&!a.branchIds?.includes(id))throw new AuthorizationError()}
async function party(tx:Prisma.TransactionClient,companyId:string,branchId:string,value:{kind:"CUSTOMER"|"VENDOR";id:string}){
 const where={id:value.id,companyId,isActive:true,branchId};
 const found=value.kind==="CUSTOMER"?await tx.customer.findFirst({where:{...where,isAccountCustomer:true},select:{name:true}}):await tx.vendor.findFirst({where:{id:value.id,companyId,isActive:true},select:{name:true}});
 if(!found)throw new Error("INVALID_PARTY_TRANSFER_PARTY");return found.name;
}
async function source(tx:Prisma.TransactionClient,companyId:string,id:string){return tx.accountOperationalAudit.findFirst({where:{companyId,entityType:"PARTY_TRANSFER",entityId:id,eventType:"PARTY_TRANSFER_POSTED"},select:{metadata:true,createdAt:true}})}
export async function partyTransferForActor(a:ProjectActor,id:string){
 await access(a);z.string().guid().parse(id);id=id.toLowerCase();const row=await source(db as unknown as Prisma.TransactionClient,a.companyId!,id);if(!row)throw new Error("PARTY_TRANSFER_NOT_FOUND");const data=partyTransferSnapshot.parse(row.metadata);branch(a,data.branchId);const reversed=await db.accountOperationalAudit.count({where:{companyId:a.companyId,entityType:"PARTY_TRANSFER",entityId:id,eventType:"PARTY_TRANSFER_REVERSED"}});return{id,...data,createdAt:row.createdAt,status:reversed?"REVERSED" as const:"POSTED" as const};
}
/** One serializable commit; no invoice allocation or company expense is created for pass-through money. */
export async function savePartyTransferForActor(a:ProjectActor,raw:unknown,file?:File){
 await access(a,true);const input=partyTransferInput.parse(raw);branch(a,input.branchId);
 const photo=file?await preparePartyTransferPhoto(file):null,amounts=partyTransferAmounts(input),{requestKey,...intent}=input,requestHash=createHash("sha256").update(JSON.stringify({...intent,photoSha256:photo?.sha256??null})).digest("hex"),companyId=a.companyId!;
 const photoObjectKey=photo?`companies/${companyId}/party-transfers/${requestKey}/${photo.sha256}.webp`:null;let uploadAttempted=false;
 try{return await retrySerializable(()=>db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM companies WHERE id=${companyId}::uuid FOR UPDATE`;
  const existing=await source(tx,companyId,requestKey);
  if(existing){const data=partyTransferSnapshot.parse(existing.metadata);branch(a,data.branchId);if(data.requestHash!==requestHash)throw new Error("IDEMPOTENCY_KEY_REUSED");const reversed=await tx.accountOperationalAudit.count({where:{companyId,entityType:"PARTY_TRANSFER",entityId:requestKey,eventType:"PARTY_TRANSFER_REVERSED"}});return{id:requestKey,...data,createdAt:existing.createdAt,status:reversed?"REVERSED" as const:"POSTED" as const}}
  const date=new Date(input.transactionDate),[receivedPartyName,paidPartyName,money,fy]=await Promise.all([
   party(tx,companyId,input.branchId,input.receivedParty),party(tx,companyId,input.branchId,input.paidParty),
   tx.moneyAccount.findFirst({where:{id:input.moneyAccountId,companyId,isActive:true,OR:[{branchId:null},{branchId:input.branchId}]}}),
   tx.financialYear.findFirst({where:{companyId,isActive:true,status:{not:"CLOSED"},startDate:{lte:date},endDate:{gte:date}}}),
  ]);
  const cash=money?await tx.ledgerAccount.findFirst({where:{id:money.ledgerAccountId,companyId,isActive:true,allowPosting:true,accountClass:"ASSET"}}):null;
  if(!money||!cash)throw new Error("INVALID_MONEY_ACCOUNT");
  if(!fy)throw new Error("INVALID_FINANCIAL_YEAR");
  const number=await allocateDocumentNumberInTx(tx,{companyId,branchId:input.branchId,seriesKey:"P2P_TRANSFER",defaults:{prefix:"PT-",padding:6}});
  let passReceiptJournalId:string|null=null,passPaymentJournalId:string|null=null,commissionIncomeId:string|null=null;
  if(new D(amounts.passThroughAmount).gt(0)){
   let clearing=await tx.ledgerAccount.findUnique({where:{companyId_code:{companyId,code:"P2P-PASS-THROUGH"}}});
   if(!clearing)clearing=await tx.ledgerAccount.create({data:{companyId,code:"P2P-PASS-THROUGH",name:"Party pass-through clearing",accountClass:"LIABILITY",normalBalance:"CREDIT",allowPosting:true,isActive:true}});
   if(clearing.accountClass!=="LIABILITY"||clearing.normalBalance!=="CREDIT"||!clearing.isActive||!clearing.allowPosting)throw new Error("INVALID_PARTY_TRANSFER_CLEARING");
   const common={financialYearId:fy.id,branchId:input.branchId,entryDate:date,reference:number,sourceId:requestKey,postingPurpose:"PRIMARY"};
   const received=await postJournalInTx(tx,a,{...common,sourceType:"PARTY_TRANSFER_PASS_RECEIPT",narration:`Pass-through received from ${receivedPartyName}. ${input.notes}`.slice(0,5000),lines:[{ledgerAccountId:money.ledgerAccountId,debit:amounts.passThroughAmount,credit:"0"},{ledgerAccountId:clearing.id,debit:"0",credit:amounts.passThroughAmount}]});passReceiptJournalId=received.id;
   const paid=await postJournalInTx(tx,a,{...common,sourceType:"PARTY_TRANSFER_PASS_PAYMENT",narration:`Pass-through paid to ${paidPartyName}. ${input.notes}`.slice(0,5000),lines:[{ledgerAccountId:clearing.id,debit:amounts.passThroughAmount,credit:"0"},{ledgerAccountId:money.ledgerAccountId,debit:"0",credit:amounts.passThroughAmount}]});passPaymentJournalId=paid.id;
  }
  if(new D(amounts.commissionAmount).gt(0)){
   const income=await tx.ledgerAccount.findFirst({where:{companyId,systemKey:"OTHER_INCOME",accountClass:"INCOME",normalBalance:"CREDIT",isActive:true,allowPosting:true}});if(!income)throw new Error("MISSING_SYSTEM_ACCOUNT");
   let category=await tx.expenseCategory.findUnique({where:{companyId_name:{companyId,name:"Party Transfer Commission"}}});
   if(!category)category=await tx.expenseCategory.create({data:{companyId,name:"Party Transfer Commission",scope:"INCOME",incomeLedgerAccountId:income.id,defaultLedgerAccountId:income.id}});
   if(!category.isActive||category.scope==="EXPENSE"||category.incomeLedgerAccountId!==income.id)throw new Error("INVALID_TRANSFER_COMMISSION_CATEGORY");
   const commission=await createExpenseForActor(a,{branchId:input.branchId,categoryId:category.id,type:"OTHER_INCOME",transactionDate:input.transactionDate,taxableAmount:amounts.commissionAmount,moneyAccountId:money.id,requestKey,recordAsPaid:true,reference:number,notes:`Commission retained from ${receivedPartyName}; pass-through paid to ${paidPartyName}. ${input.notes}`.slice(0,5000)},undefined,tx);commissionIncomeId=commission.id;
  }
  if(photo&&photoObjectKey){uploadAttempted=true;await privateStorage().put(photoObjectKey,photo.bytes)}
  const data=partyTransferSnapshot.parse({...intent,...amounts,photoObjectKey,photoSha256:photo?.sha256??null,photoMimeType:photo?.mimeType??null,version:1,requestHash,number,receivedPartyName,paidPartyName,passReceiptJournalId,passPaymentJournalId,commissionIncomeId});
  const saved=await tx.accountOperationalAudit.create({data:{companyId,actorUserId:a.id,entityType:"PARTY_TRANSFER",entityId:requestKey,eventType:"PARTY_TRANSFER_POSTED",metadata:data}});
  return{id:requestKey,...data,createdAt:saved.createdAt,status:"POSTED" as const};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000}),4,["companyId","entityId"],[["companyId","sourceType","sourceId","postingPurpose"],["companyId","creationRequestKey"]]);}catch(error){
  if(uploadAttempted&&photoObjectKey){
   const retained=await db.accountOperationalAudit.findFirst({where:{companyId,entityType:"PARTY_TRANSFER",entityId:requestKey,eventType:"PARTY_TRANSFER_POSTED",metadata:{path:["photoObjectKey"],equals:photoObjectKey}},select:{id:true}}).then(Boolean).catch(()=>true);
   if(!retained)try{await privateStorage().delete(photoObjectKey)}catch{/* A failed cleanup must never delete committed data or hide the original failure. */}
  }
  throw error;
 }
}

export async function partyTransferPhotoForActor(a:ProjectActor,id:string){
 const row=await partyTransferForActor(a,id);if(!row.photoObjectKey||!row.photoObjectKey.startsWith(`companies/${a.companyId}/party-transfers/${row.id}/`))throw new Error("PARTY_TRANSFER_PHOTO_NOT_FOUND");
 const bytes=await privateStorage().get(assertSafeObjectKey(row.photoObjectKey));if(createHash("sha256").update(bytes).digest("hex")!==row.photoSha256)throw new Error("PARTY_TRANSFER_PHOTO_INTEGRITY_FAILED");
 return{bytes,mimeType:"image/webp" as const};
}

/** Explicit company/assignment filters; no ambient browser branch cookie is trusted. */
export async function partyTransferOptionsForActor(a:ProjectActor){
 await access(a);
 const branches=await db.branch.findMany({where:{companyId:a.companyId,isActive:true,...(a.branchAccessScope==="SELECTED_BRANCHES"?{id:{in:a.branchIds??[]}}:{})},select:{id:true,name:true},orderBy:{name:"asc"}}),branchIds=branches.map(row=>row.id);
 if(!branchIds.length)return{branches,customers:[],vendors:[],accounts:[],canPost:false};
 const [customers,vendors,accounts]=await Promise.all([
  db.customer.findMany({where:{companyId:a.companyId,isActive:true,isAccountCustomer:true,branchId:{in:branchIds}},select:{id:true,name:true,branchId:true},orderBy:{name:"asc"}}),
  db.vendor.findMany({where:{companyId:a.companyId,isActive:true},select:{id:true,name:true},orderBy:{name:"asc"}}),
  db.moneyAccount.findMany({where:{companyId:a.companyId,isActive:true,OR:[{branchId:null},{branchId:{in:branchIds}}]},select:{id:true,name:true,branchId:true,type:true},orderBy:{name:"asc"}}),
 ]);
 return{branches,customers,vendors,accounts,canPost:canUsePermission(a,"SALESPUNCH360_ACCOUNT","ACCOUNT_MONEY_ENTRY")&&canUsePermission(a,"SALESPUNCH360_ACCOUNT","ACCOUNT_JOURNAL_POST")};
}

const reversalInput=z.object({requestKey:z.string().guid().transform(value=>value.toLowerCase()),entryDate:z.string().date(),reason:z.string().trim().min(3).max(1000)}).strict();
/** Reverse the entire managed source; its original immutable snapshot remains intact. */
export async function reversePartyTransferForActor(a:ProjectActor,id:string,raw:unknown){
 await access(a,true);if(a.accountRole!=="ACCOUNT_ADMIN")throw new AuthorizationError();
 id=z.string().guid().parse(id).toLowerCase();const input=reversalInput.parse(raw);
 const requestHash=createHash("sha256").update(JSON.stringify({id,...input})).digest("hex");
 return retrySerializable(()=>db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM companies WHERE id=${a.companyId}::uuid FOR UPDATE`;
  const posted=await source(tx,a.companyId,id);if(!posted)throw new Error("PARTY_TRANSFER_NOT_FOUND");const snapshot=partyTransferSnapshot.parse(posted.metadata);branch(a,snapshot.branchId);
  const previous=await tx.accountOperationalAudit.findFirst({where:{companyId:a.companyId,entityType:"PARTY_TRANSFER",entityId:id,eventType:"PARTY_TRANSFER_REVERSED"},select:{metadata:true}});
  if(previous){const metadata=previous.metadata as {requestHash?:string};if(metadata.requestHash!==requestHash)throw new Error("PARTY_TRANSFER_ALREADY_REVERSED");return{id,status:"REVERSED" as const}}
  const entryDate=new Date(input.entryDate),journalIds:string[]=[];
  for(const journalEntryId of [snapshot.passReceiptJournalId,snapshot.passPaymentJournalId])if(journalEntryId){const row=await reverseJournalInTx(tx,a,{journalEntryId,entryDate,reason:input.reason},{partyTransferId:id});journalIds.push(row.id)}
  if(snapshot.commissionIncomeId){const row=await reverseExpenseForActor(a,snapshot.commissionIncomeId,entryDate,input.reason,{transaction:tx,partyTransferId:id});journalIds.push(row.id)}
  await tx.accountOperationalAudit.create({data:{companyId:a.companyId,actorUserId:a.id,entityType:"PARTY_TRANSFER",entityId:id,eventType:"PARTY_TRANSFER_REVERSED",metadata:{version:1,requestKey:input.requestKey,requestHash,entryDate:input.entryDate,reason:input.reason,reversalJournalIds:journalIds}}});
  return{id,status:"REVERSED" as const};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000}),4);
}
