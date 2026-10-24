import {randomUUID} from "node:crypto";
import {Prisma,type AccountSettlement,type CommercialDocument} from "@prisma/client";
import {z} from "zod";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {postJournalInTx} from "@/lib/accounting/service";
import {allocateDocumentNumberInTx} from "./numbering";
import {requireAccountModules} from "./modules";
import {ensureOpenFinancialYearForDate} from "./financial-year";
import {authorizeProjectForCommercial,type ProjectActor} from "./projects";
type Source={id:string;document:CommercialDocument;payment:AccountSettlement;amount:Prisma.Decimal;discount:Prisma.Decimal;date:Date;posted:boolean;prior:AccountSettlement|null};
type Kind="RECEIPT"|"ADVANCE_APPLICATION";
async function correctionCreditInTx(tx:Prisma.TransactionClient,actor:ProjectActor,kind:Kind,sourceId:string,date:Date){
 if(!["ACCOUNT_ADMIN","ACCOUNTANT"].includes(actor.accountRole??"")||
  !canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_SALES_ENTRY")||
  !canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_SETTLEMENT_ENTRY")||
  !canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_JOURNAL_POST"))throw new AuthorizationError();
 await requireAccountModules(actor,"SALES","CUSTOMER_ADVANCES",...(kind==="RECEIPT"?["CUSTOMER_RECEIPTS" as const]:[]));
 await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR UPDATE`;
 let source:Source|null=null;
 if(kind==="RECEIPT"){
  await tx.$queryRaw`SELECT id FROM settlement_allocations WHERE id=${sourceId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const row=await tx.settlementAllocation.findFirst({where:{id:sourceId,companyId:actor.companyId},include:{settlement:{include:{journalEntry:true}},document:true,receiptAdvanceCredit:true}});
  if(row)source={id:row.id,document:row.document,payment:row.settlement,amount:row.amount,discount:row.discountAmount,date:row.settlement.transactionDate,posted:row.settlement.journalEntry?.status==="POSTED",prior:row.receiptAdvanceCredit};
 }else{
  await tx.$queryRaw`SELECT id FROM advance_applications WHERE id=${sourceId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const row=await tx.advanceApplication.findFirst({where:{id:sourceId,companyId:actor.companyId},include:{advance:{include:{journalEntry:true}},journalEntry:true,document:true,releasedAdvanceCredit:true}});
  if(row)source={id:row.id,document:row.document,payment:row.advance,amount:row.amount,discount:new Prisma.Decimal(0),date:row.applicationDate,posted:row.advance.journalEntry?.status==="POSTED"&&row.journalEntry.status==="POSTED",prior:row.releasedAdvanceCredit};
 }
 if(!source||(actor.branchAccessScope==="SELECTED_BRANCHES"&&!actor.branchIds?.includes(source.document.branchId)))throw new AuthorizationError();
 const {document,payment}=source;
 if(document.type!=="SALES_INVOICE"||document.status!=="POSTED"||payment.type!==(kind==="RECEIPT"?"CUSTOMER_RECEIPT":"CUSTOMER_ADVANCE")||payment.status!=="POSTED"||!source.posted||payment.branchId!==document.branchId||payment.partyId!==document.partyId)throw new Error("INVALID_RECEIPT_ADVANCE_CREDIT");
 if(document.projectId)await authorizeProjectForCommercial(actor,document.projectId,document.branchId,document.customerId??undefined,tx);
 if(source.prior){if(source.prior.transactionDate.getTime()!==date.getTime())throw new Error("IDEMPOTENCY_KEY_REUSED");return source.prior;}
 if(date<source.date||date<document.issueDate)throw new Error("INVALID_RECEIPT_ADVANCE_CREDIT_DATE");
 const amount=source.amount.sub(source.discount);
 if(!amount.gt(0))throw new Error("INVALID_RECEIPT_ADVANCE_CREDIT");
 const year=await ensureOpenFinancialYearForDate(actor.companyId,date,tx);
 const keys=["ACCOUNTS_RECEIVABLE","CUSTOMER_ADVANCES",...(source.discount.gt(0)?["SALES_INCOME"]:[])];
 const accounts=await tx.ledgerAccount.findMany({where:{companyId:actor.companyId,isActive:true,allowPosting:true,systemKey:{in:keys}}});
 const account=(key:string)=>{const row=accounts.find(x=>x.systemKey===key);if(!row)throw new Error("INVALID_LEDGER_ACCOUNT");return row.id};
 const id=randomUUID(),journal=await postJournalInTx(tx,actor,{financialYearId:year.id,branchId:document.branchId,entryDate:date,sourceType:"CUSTOMER_ADVANCE",sourceId:id,postingPurpose:"PRIMARY",lines:[
  {ledgerAccountId:account("ACCOUNTS_RECEIVABLE"),debit:source.amount.toFixed(2),credit:"0",description:"Release original payment application"},
  {ledgerAccountId:account("CUSTOMER_ADVANCES"),debit:"0",credit:amount.toFixed(2),description:"Customer advance credit; no cash movement"},
  ...(source.discount.gt(0)?[{ledgerAccountId:account("SALES_INCOME"),debit:"0",credit:source.discount.toFixed(2),description:"Restore released payment discount"}]:[]),
 ]});
 const settlementNumber=await allocateDocumentNumberInTx(tx,{companyId:actor.companyId,branchId:document.branchId,seriesKey:"CUSTOMER_ADVANCE",defaults:{prefix:"CA-",padding:6}});
 const credit=await tx.accountSettlement.create({data:{id,companyId:actor.companyId,branchId:document.branchId,type:"CUSTOMER_ADVANCE",status:"POSTED",paymentMode:"ACCOUNT_CREDIT",...(kind==="RECEIPT"?{receiptCreditSourceAllocationId:source.id}:{advanceCreditSourceApplicationId:source.id}),settlementNumber,partyId:payment.partyId,customerId:document.customerId,projectId:document.projectId,amount,remainingAmount:amount,transactionDate:date,journalEntryId:journal.id,idempotencyKey:`correction-credit:${kind}:${source.id}`,createdById:actor.id,reference:document.documentNumber.slice(0,160),notes:"Advance credit from invoice correction; original payment retained"}});
 await tx.accountOperationalAudit.create({data:{companyId:actor.companyId,actorUserId:actor.id,eventType:"PAYMENT_RECLASSIFIED_TO_ADVANCE",entityType:"ACCOUNT_SETTLEMENT",entityId:credit.id,metadata:{sourceKind:kind,sourceId:source.id,sourceSettlementId:payment.id,sourceInvoiceId:document.id,allocationAmount:source.amount.toFixed(2),advanceAmount:amount.toFixed(2),releasedDiscount:source.discount.toFixed(2),journalEntryId:journal.id}}});
 return credit;
}
/** Internal primitives: release and correction/reapplication must share a transaction. */
export async function receiptAdvanceCreditInTx(tx:Prisma.TransactionClient,actor:ProjectActor,raw:unknown){
 const input=z.object({allocationId:z.string().guid(),entryDate:z.coerce.date()}).strict().parse(raw);
 return correctionCreditInTx(tx,actor,"RECEIPT",input.allocationId,input.entryDate);
}
export async function advanceApplicationCreditInTx(tx:Prisma.TransactionClient,actor:ProjectActor,raw:unknown){
 const input=z.object({applicationId:z.string().guid(),entryDate:z.coerce.date()}).strict().parse(raw);
 return correctionCreditInTx(tx,actor,"ADVANCE_APPLICATION",input.applicationId,input.entryDate);
}
