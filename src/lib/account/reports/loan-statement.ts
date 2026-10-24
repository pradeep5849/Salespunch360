import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError,requirePermission} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import type {ProjectActor} from "../projects";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
function authorize(actor:ProjectActor){if(!actor.companyId||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_REPORTS")||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_MONEY_VIEW"))throw new AuthorizationError()}
function scope(actor:ProjectActor){return{companyId:actor.companyId,...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{})}}
export async function loanStatementOptionsForActor(actor:ProjectActor){authorize(actor);const loans=await db.loan.findMany({where:scope(actor),select:{id:true,displayName:true,lender:true},orderBy:[{lender:"asc"},{id:"asc"}]});return loans.map(x=>({id:x.id,name:x.displayName||x.lender}))}
export async function loanStatementOptions(){return loanStatementOptionsForActor(await requirePermission("ACCOUNT_REPORTS") as ProjectActor)}
type Row={id:string;entryDate:Date;sourceType:string;journalNumber:string;narration:string|null;debit:Prisma.Decimal;credit:Prisma.Decimal;balance:Prisma.Decimal;payment:Prisma.Decimal|null;principal:Prisma.Decimal|null;interest:Prisma.Decimal|null};
/** Accounting history only. Never substitute the editable starting principal for a posted balance. */
export async function loanStatementReport(c:FinancialReportContext):Promise<ReportResult>{
 authorize(c.actor);const title="Loan Statement",columns=["Date","Transaction Type","Description","Amount","Balance"];
 if(!c.f.loanId)return{title,columns,rows:[],note:"Select a loan account to view its statement."};
 const from=new Date(`${c.from.toISOString().slice(0,10)}T00:00:00.000Z`),to=new Date(`${c.to.toISOString().slice(0,10)}T23:59:59.999Z`);
 return db.$transaction(async tx=>{
  const loan=await tx.loan.findFirst({where:{...scope(c.actor),...c.branch,id:c.f.loanId},select:{id:true,branchId:true,liabilityLedgerId:true,displayName:true,lender:true}});
  if(!loan)throw new AuthorizationError();
  if(await tx.loan.count({where:{companyId:c.actor.companyId,branchId:loan.branchId,liabilityLedgerId:loan.liabilityLedgerId}})>1)return{title,columns,rows:[],note:"This legacy liability ledger is shared by multiple loans. Individual loan balances cannot be attributed safely; review the General Ledger."};
  const base=Prisma.sql`SELECT j.id,j."entryDate",j."createdAt",j."journalNumber",j."sourceType",j.narration,
   COALESCE(SUM(l.debit) FILTER(WHERE l."ledgerAccountId"=${loan.liabilityLedgerId}::uuid),0) AS debit,
   COALESCE(SUM(l.credit) FILTER(WHERE l."ledgerAccountId"=${loan.liabilityLedgerId}::uuid),0) AS credit,
   COALESCE(MAX((p.principal+p.interest+p.charges)*CASE WHEN j."reversalOfId" IS NULL THEN 1 ELSE -1 END),CASE WHEN NOT BOOL_OR(l."ledgerAccountId"=${loan.liabilityLedgerId}::uuid) THEN MAX(o.amount*CASE WHEN j."reversalOfId" IS NULL THEN 1 ELSE -1 END) END) AS payment,
   MAX(p.principal*CASE WHEN j."reversalOfId" IS NULL THEN 1 ELSE -1 END) AS principal,
   MAX(p.interest*CASE WHEN j."reversalOfId" IS NULL THEN 1 ELSE -1 END) AS interest
   FROM journal_entries j JOIN journal_lines l ON l."journalEntryId"=j.id AND l."companyId"=j."companyId"
   LEFT JOIN loan_payments p ON p."companyId"=j."companyId" AND p."loanId"=${loan.id}::uuid AND(p."journalEntryId"=j.id OR p."journalEntryId"=j."reversalOfId")
   LEFT JOIN loan_operations o ON o."companyId"=j."companyId" AND o."loanId"=${loan.id}::uuid AND o.action='OPENING_FEE' AND(o."journalEntryId"=j.id OR o."journalEntryId"=j."reversalOfId")
   WHERE j."companyId"=${c.actor.companyId}::uuid AND j."branchId"=${loan.branchId}::uuid AND j.status IN('POSTED','REVERSED') AND j."entryDate"<=${to}
   GROUP BY j.id HAVING BOOL_OR(l."ledgerAccountId"=${loan.liabilityLedgerId}::uuid) OR COUNT(p.id)>0 OR COUNT(o.id)>0`;
  const [stats]=await tx.$queryRaw<Array<{opening:Prisma.Decimal;balance:Prisma.Decimal;postings:bigint}>>(Prisma.sql`WITH postings AS(${base}) SELECT COALESCE(SUM(credit-debit) FILTER(WHERE "entryDate"<${from}),0) AS opening,COALESCE(SUM(credit-debit),0) AS balance,COUNT(*) FILTER(WHERE debit<>0 OR credit<>0) AS postings FROM postings`);
  if(!stats.postings)return{title,columns,rows:[],note:"No posted liability history exists for this loan through the selected cutoff. An unposted starting amount is not a confirmed balance."};
  const rows:ReportResult["rows"]=[];let offset=0,principal=new D(0),interest=new D(0);
  for(;;){
   const page=await tx.$queryRaw<Row[]>(Prisma.sql`WITH postings AS(${base}),balances AS(SELECT *,SUM(credit-debit) OVER(ORDER BY "entryDate","createdAt",id) AS balance FROM postings) SELECT * FROM balances WHERE "entryDate">=${from} ORDER BY "entryDate","createdAt",id LIMIT 1000 OFFSET ${offset}`);
   for(const row of page){principal=principal.add(row.principal??0);interest=interest.add(row.interest??0);rows.push([row.entryDate.toISOString().slice(0,10),row.sourceType.replaceAll("_"," "),row.narration||row.journalNumber,(row.payment??new D(row.credit).sub(row.debit)).toFixed(2),row.balance.toFixed(2)])}
   if(page.length<1000)break;offset+=page.length;
  }
  return{title,columns,rows,summary:[{label:"Opening Balance",value:stats.opening.toFixed(2),money:true},{label:"Balance Due",value:stats.balance.toFixed(2),money:true},{label:"Total Principal Paid",value:principal.toFixed(2),money:true},{label:"Total Interest Paid",value:interest.toFixed(2),money:true}],note:`Loan: ${loan.displayName||loan.lender}. Opening is the posted liability balance before the selected period; balance due includes all posted history through its end. Payment amounts include recorded principal, interest and charges; correcting reversals subtract them. Other journals show signed liability movement, not a presumed cash payment. Principal/interest paid summarize only recorded loan payments in this period. Archived loans remain available. Opening processing fees follow the recorded deducted/separately-paid choice;deducted fees are included in the receipt narration and do not reduce gross principal.`};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
