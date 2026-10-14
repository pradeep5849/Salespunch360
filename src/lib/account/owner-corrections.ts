import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { reverseJournalInTx } from "@/lib/accounting/service";
import type { ProjectActor } from "./projects";
import { retrySerializable } from "./transaction-retry";

export function canCorrectOwnerTransaction(actor: ProjectActor) {
 return canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_MONEY_ENTRY") && canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_JOURNAL_REVERSE");
}
const input=z.object({branchId:z.string().uuid().optional(),ownerId:z.string().uuid(),transactionId:z.string().uuid(),entryDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>!Number.isNaN(new Date(value).getTime())&&new Date(value).toISOString().slice(0,10)===value,"Enter a valid date"),reason:z.string().trim().min(3).max(1000)}).strict();
/** One retained source transaction has one dated, balanced correction. Replays cannot post twice. */
export async function reverseOwnerTransactionForActor(actor:ProjectActor,raw:unknown){
 if(!canCorrectOwnerTransaction(actor))throw new AuthorizationError();
 const d=input.parse(raw);
 return retrySerializable(()=>db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 FROM "companies" WHERE "id"=${actor.companyId}::uuid FOR UPDATE`;
  const row=await tx.ownerTransaction.findFirst({where:{companyId:actor.companyId,id:d.transactionId,ownerFinancialAccountId:d.ownerId,...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{})}});
  if(!row||d.branchId&&row.branchId!==d.branchId)throw new AuthorizationError();
  const journal=await tx.journalEntry.findFirst({where:{companyId:actor.companyId,id:row.journalEntryId},include:{reversedBy:true}});
  if(!journal||journal.sourceId!==row.id||journal.sourceType!==row.type)throw new Error("INVALID_OWNER_TRANSACTION_SOURCE");
  if(new Date(d.entryDate)<row.transactionDate)throw new Error("OWNER_CORRECTION_BEFORE_TRANSACTION");
  if(journal.reversedBy){
   if(journal.status!=="REVERSED"||journal.reversedBy.status!=="POSTED")throw new Error("INVALID_OWNER_TRANSACTION_SOURCE");
   if(journal.reversedBy.entryDate.toISOString().slice(0,10)!==d.entryDate||journal.reversedBy.reversalReason!==d.reason)throw new Error("OWNER_CORRECTION_ALREADY_POSTED");
   return {id:journal.reversedBy.id,transactionId:row.id};
  }
  const reversal=await reverseJournalInTx(tx,actor,{journalEntryId:journal.id,entryDate:d.entryDate,reason:d.reason});
  return {id:reversal.id,transactionId:row.id};
 },{isolationLevel:"Serializable"}));
}
