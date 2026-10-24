import {sumPersistedMoney} from "./money-sum";
import {Prisma,LoanStatus} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {moneyReadContext} from "./money-context";
import type {ProjectActor} from "./projects";
const input=z.object({branchId:z.string().guid().optional(),scope:z.literal("all").optional(),q:z.string().trim().max(160).optional(),archived:z.enum(["","active","archived"]).optional(),status:z.preprocess(v=>v===""?undefined:v,z.nativeEnum(LoanStatus).optional()),offset:z.coerce.number().int().min(0).max(1000000).prefault(0),limit:z.coerce.number().int().min(1).max(100).prefault(50)}).strict();
/** Debt balances come from effective posted liability lines, never the latest
 * payment page. A legacy record without any posted liability remains unknown. */
export async function loanOverviewForActor(actor:ProjectActor,raw:unknown={}) {
 const f=input.parse(raw),resolved=await moneyReadContext(actor,{...(f.branchId?{branchId:f.branchId}:{}),...(f.scope?{scope:f.scope}:{})});
 const branch=resolved.context.mode==="BRANCH"?resolved.context.branchId:undefined;
 const where:Prisma.LoanWhereInput={companyId:actor.companyId,...(f.archived==="active"?{archivedAt:null}:f.archived==="archived"?{archivedAt:{not:null}}:{}),...(branch?{branchId:branch}:{}),...(f.status?{status:f.status}:{}),...(f.q?{OR:[{displayName:{contains:f.q,mode:"insensitive"}},{loanAccountNumber:{contains:f.q,mode:"insensitive"}},{lender:{contains:f.q,mode:"insensitive"}},{loanType:{contains:f.q,mode:"insensitive"}},{reference:{contains:f.q,mode:"insensitive"}}]}:{})};
 return db.$transaction(async tx=>{
  const [rows,total,matching]=await Promise.all([
   tx.loan.findMany({where,orderBy:[{startDate:"desc"},{createdAt:"desc"},{id:"desc"}],take:f.limit,skip:f.offset}),
   tx.loan.count({where}),
   tx.loan.findMany({where,select:{id:true,branchId:true,liabilityLedgerId:true}}),
  ]);
  const balances=matching.length?await tx.$queryRaw<Array<{id:string;balance:Prisma.Decimal;journals:bigint}>>(Prisma.sql`
   SELECT x.id,COALESCE(SUM(l.credit-l.debit),0) AS balance,COUNT(DISTINCT j.id) AS journals
   FROM loans x JOIN journal_lines l ON l."companyId"=x."companyId" AND l."ledgerAccountId"=x."liabilityLedgerId"
   JOIN journal_entries j ON j.id=l."journalEntryId" AND j."companyId"=x."companyId" AND j."branchId"=x."branchId"
   WHERE x."companyId"=${actor.companyId}::uuid AND x.id IN (${Prisma.join(matching.map(x=>Prisma.sql`${x.id}::uuid`))}) AND j.status IN ('POSTED','REVERSED') AND NOT EXISTS (SELECT 1 FROM loans other WHERE other."companyId"=x."companyId" AND other."branchId"=x."branchId" AND other."liabilityLedgerId"=x."liabilityLedgerId" AND other.id<>x.id) GROUP BY x.id`):[];
  const byId=new Map(balances.map(row=>[row.id,row]));
  const outstanding=sumPersistedMoney(balances.map(row=>row.balance));
  return {rows:rows.map(row=>({...row,outstanding:byId.get(row.id)?.balance.toString()??null})),total,outstanding:new Prisma.Decimal(outstanding).toString(),unpostedBalanceCount:matching.length-balances.length,offset:f.offset,limit:f.limit,nextOffset:f.offset+rows.length<total?f.offset+rows.length:null,branchContext:resolved.context};
 },{isolationLevel:"RepeatableRead"});
}
