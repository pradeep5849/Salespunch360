import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {LEDGER_EFFECTIVE_JOURNAL_STATUSES} from "@/lib/accounting/ledger-policy";
import {reportCalendarDate} from "./dates";
import type {FinancialReportContext,ReportFilter,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
/** A Day Book has one selected business date. A carried range selects its final day. */
export function dayBookFilterDates(f:Pick<ReportFilter,"from"|"to"|"asOf">,now=new Date()){
 if(f.from&&f.to&&f.to<f.from)throw new Error("INVALID_DATE_RANGE");
 const day=reportCalendarDate(f.to??f.asOf??f.from??now);
 return {from:new Date(`${day}T00:00:00.000Z`),to:new Date(`${day}T00:00:00.000Z`)};
}
/** Actual posted Cash/Bank ledger movement; never a substitute for revenue/profit. */
export async function dayBookReport(c:FinancialReportContext):Promise<ReportResult>{
 if(!c.actor.companyId||!["ACCOUNT_ADMIN","ACCOUNTANT"].includes(c.actor.accountRole??"")||!canUsePermission(c.actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_REPORTS")||!canUsePermission(c.actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_MONEY_VIEW"))throw new AuthorizationError();
 return db.$transaction(async tx=>{
  const accounts=await tx.moneyAccount.findMany({where:{companyId:c.actor.companyId,...(c.f.branchId?{OR:[{branchId:null},{branchId:c.f.branchId}]}:c.actor.branchAccessScope==="SELECTED_BRANCHES"?{OR:[{branchId:null},{branchId:{in:c.actor.branchIds??[]}}]}:{})},select:{ledgerAccountId:true,name:true}});
  const names=new Map(accounts.map(account=>[account.ledgerAccountId,account.name]));
  const scope={companyId:c.actor.companyId,OR:[{ledgerAccount:{systemKey:{in:["CASH","BANK"]}}},{ledgerAccountId:{in:accounts.map(account=>account.ledgerAccountId)}}]};
  const journal={companyId:c.actor.companyId,status:{in:[...LEDGER_EFFECTIVE_JOURNAL_STATUSES]},...c.branch};
  const prior=await tx.journalLine.aggregate({where:{...scope,journalEntry:{...journal,entryDate:{lt:c.from}}},_sum:{debit:true,credit:true}});
  const opening=new D(prior._sum.debit??0).sub(prior._sum.credit??0);let incoming=new D(0),outgoing=new D(0),cursor:string|undefined;
  const rows:ReportResult["rows"]=[];
  for(;;){
   const lines=await tx.journalLine.findMany({where:{...scope,journalEntry:{...journal,entryDate:{gte:c.from,lte:c.to}}},select:{id:true,ledgerAccountId:true,debit:true,credit:true,description:true,ledgerAccount:{select:{name:true}},journalEntry:{select:{entryDate:true,journalNumber:true,narration:true,reference:true}}},orderBy:[{journalEntry:{entryDate:"asc"}},{journalEntryId:"asc"},{lineNumber:"asc"},{id:"asc"}],take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   for(const line of lines){incoming=incoming.add(line.debit);outgoing=outgoing.add(line.credit);rows.push([line.journalEntry.entryDate.toISOString().slice(0,10),line.journalEntry.journalNumber,names.get(line.ledgerAccountId)??line.ledgerAccount.name,line.description||line.journalEntry.narration||line.journalEntry.reference||line.journalEntry.journalNumber,line.debit.toFixed(2),line.credit.toFixed(2)])}
   if(lines.length<1000)break;cursor=lines[lines.length-1].id;
  }
  const net=incoming.sub(outgoing),closing=opening.add(net);
  return {title:"Day Book",columns:["Date","Journal","Account","Description","Money In","Money Out"],rows,totals:["Total","","","",incoming.toFixed(2),outgoing.toFixed(2)],summary:[{label:"Opening Balance",value:opening.toFixed(2),money:true},{label:"Money In",value:incoming.toFixed(2),money:true},{label:"Money Out",value:outgoing.toFixed(2),money:true},{label:"Net Movement",value:net.toFixed(2),money:true},{label:"Closing Balance",value:closing.toFixed(2),money:true}],note:`Business date: ${c.to.toISOString().slice(0,10)}. Opening + money in − money out = closing. Posted ledger entries for authorized company/branches only, including correcting reversals on their recorded dates and inactive accounts for historical completeness. Legacy Cash/Bank and named money-account ledgers are included. Internal transfers appear on both sides. Pending cheques and draft journals do not change cash/bank. Net movement is not revenue or profit. No ledger changes.`};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
