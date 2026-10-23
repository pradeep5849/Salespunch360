import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {LEDGER_EFFECTIVE_JOURNAL_STATUSES} from "@/lib/accounting/ledger-policy";
import {requireAccountModules} from "../modules";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
/** One row per posted accounting entry, rather than counting both a business
 * document and its journal as two transactions. No source-type allowlist can
 * silently omit loan, owner, expense, correction or project financial history. */
export async function allTransactionsReport(c:FinancialReportContext):Promise<ReportResult>{
 if(!c.actor.companyId||!canUsePermission(c.actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_LEDGER_VIEW"))throw new AuthorizationError();
 await requireAccountModules(c.actor,"SALES");
 const companyId=c.actor.companyId;
 return db.$transaction(async tx=>{
  const rows:ReportResult["rows"]=[];let cursor:string|undefined,debit=new D(0),credit=new D(0);
  for(;;){
   const entries=await tx.journalEntry.findMany({where:{companyId,...c.branch,status:{in:[...LEDGER_EFFECTIVE_JOURNAL_STATUSES]},entryDate:{gte:c.from,lte:c.to}},select:{id:true,journalNumber:true,entryDate:true,reference:true,narration:true,sourceType:true,status:true,reversalOfId:true},orderBy:[{entryDate:"asc"},{id:"asc"}],take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})});
   if(!entries.length)break;
   const totals=await tx.journalLine.groupBy({by:["journalEntryId"],where:{companyId,journalEntryId:{in:entries.map(row=>row.id)}},_sum:{debit:true,credit:true}}),amounts=new Map(totals.map(row=>[row.journalEntryId,{debit:new D(row._sum.debit??0),credit:new D(row._sum.credit??0)}]));
   for(const entry of entries){const amount=amounts.get(entry.id)??{debit:new D(0),credit:new D(0)};debit=debit.add(amount.debit);credit=credit.add(amount.credit);rows.push([entry.entryDate.toISOString().slice(0,10),entry.journalNumber,entry.sourceType.replaceAll("_"," "),entry.reference??"",entry.narration??"",entry.reversalOfId?"Reversal":entry.status==="REVERSED"?"Reversed original":"Posted",amount.debit.toFixed(2),amount.credit.toFixed(2)])}
   if(entries.length<1000)break;cursor=entries[entries.length-1].id;
  }
  return{title:"All Transactions",columns:["Date","Journal","Transaction Type","Reference","Description","Status","Debit","Credit"],rows,totals:["Total","","","","","",debit.toFixed(2),credit.toFixed(2)],summary:[{label:"Total Debit",value:debit.toFixed(2),money:true},{label:"Total Credit",value:credit.toFixed(2),money:true},{label:"Debit minus Credit",value:debit.sub(credit).toFixed(2),money:true}],note:"All posted accounting entries in the selected company, authorized branches and period, including original entries and their correcting reversals on their recorded dates. Each journal appears once; all source types are included, including loans, owners, expenses, opening balances and project movements that post to the ledger. Debit and credit totals are the two sides of double entry; they are not revenue, profit or cash flow. Non-posting orders, estimates, unsaved forms and legacy documents without a posted journal have no ledger entry in this report. Current module switches do not remove recorded financial history. No financial writes."};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
