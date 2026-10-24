import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError,requirePermission} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {LEDGER_EFFECTIVE_JOURNAL_STATUSES} from "@/lib/accounting/ledger-policy";
import type {ProjectActor} from "../projects";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
function authorize(actor:ProjectActor) {
 if(!actor.companyId||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_REPORTS")||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_MONEY_VIEW"))throw new AuthorizationError();
}
function bankScope(actor:ProjectActor,branchId?:string) {
 return {companyId:actor.companyId,type:"BANK" as const,...(branchId?{OR:[{branchId:null},{branchId}]}:actor.branchAccessScope==="SELECTED_BRANCHES"?{OR:[{branchId:null},{branchId:{in:actor.branchIds??[]}}]}:{})};
}
export async function bankStatementOptionsForActor(actor:ProjectActor) {
 authorize(actor);
 return db.moneyAccount.findMany({where:bankScope(actor),select:{id:true,name:true},orderBy:[{name:"asc"},{id:"asc"}]});
}
export async function bankStatementOptions() {
 return bankStatementOptionsForActor(await requirePermission("ACCOUNT_REPORTS") as ProjectActor);
}
/** A read-only ledger statement; bank opening fields and pending cheques are not
 * substitutes for posted journal history. Reversals follow the shared ledger policy. */
export async function bankStatementReport(c:FinancialReportContext):Promise<ReportResult> {
 authorize(c.actor);
 const columns=["Date","Description","Withdrawal","Deposit"];
 if(!c.f.moneyAccountId)return {title:"Bank Statement",columns,rows:[],note:"Select a bank account to view its statement."};
 const from=new Date(`${c.from.toISOString().slice(0,10)}T00:00:00.000Z`),to=new Date(`${c.to.toISOString().slice(0,10)}T23:59:59.999Z`);
 return db.$transaction(async tx=>{
  const account=await tx.moneyAccount.findFirst({where:{...bankScope(c.actor,c.f.branchId),id:c.f.moneyAccountId},select:{id:true,name:true,ledgerAccountId:true}});
  if(!account)throw new AuthorizationError();
  const scope={companyId:c.actor.companyId,ledgerAccountId:account.ledgerAccountId};
  const journal={companyId:c.actor.companyId,status:{in:[...LEDGER_EFFECTIVE_JOURNAL_STATUSES]},...c.branch};
  const opening=await tx.journalLine.aggregate({where:{...scope,journalEntry:{...journal,entryDate:{lt:from}}},_sum:{debit:true,credit:true}});
  const start=new D(opening._sum.debit??0).sub(opening._sum.credit??0);
  let deposits=new D(0),withdrawals=new D(0),cursor:string|undefined;
  const rows:ReportResult["rows"]=[];
  for(;;){
   const lines=await tx.journalLine.findMany({where:{...scope,journalEntry:{...journal,entryDate:{gte:from,lte:to}}},select:{id:true,debit:true,credit:true,description:true,journalEntry:{select:{entryDate:true,journalNumber:true,narration:true,reference:true}}},orderBy:[{journalEntry:{entryDate:"asc"}},{journalEntryId:"asc"},{lineNumber:"asc"},{id:"asc"}],take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   for(const line of lines){deposits=deposits.add(line.debit);withdrawals=withdrawals.add(line.credit);rows.push([line.journalEntry.entryDate.toISOString().slice(0,10),line.description||line.journalEntry.narration||line.journalEntry.reference||line.journalEntry.journalNumber,line.credit.toFixed(2),line.debit.toFixed(2)])}
   if(lines.length<1000)break;cursor=lines[lines.length-1].id;
  }
  return {title:"Bank Statement",columns,rows,summary:[{label:"Opening Balance",value:start.toFixed(2),money:true},{label:"Withdrawals",value:withdrawals.toFixed(2),money:true},{label:"Deposits",value:deposits.toFixed(2),money:true},{label:"Balance",value:start.add(deposits).sub(withdrawals).toFixed(2),money:true}],note:`Bank: ${account.name}. Opening + deposits − withdrawals = balance. Only effective posted ledger entries in the selected branch and period are included. Inactive bank accounts remain available for historical statements; pending cheques do not change the bank balance.`};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
