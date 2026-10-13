import {Prisma} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {moneyReadContext} from "./money-context";
import type {ProjectActor} from "./projects";
const query=z.object({branchId:z.string().uuid().optional(),scope:z.literal("all").optional(),offset:z.coerce.number().int().min(0).max(1000000).default(0),limit:z.coerce.number().int().min(1).max(100).default(50)}).strict();
type Row={id:string;entryDate:Date;journalNumber:string;sourceType:string;status:string;debit:Prisma.Decimal;credit:Prisma.Decimal;balance:Prisma.Decimal;payment:Prisma.Decimal|null};
/** Include fee-only payments and correcting reversal journals, with balances
 * computed over the full history before pagination. */
export async function loanHistoryForActor(actor:ProjectActor,id:string,raw:unknown={}){
 z.string().uuid().parse(id);const f=query.parse(raw);const resolved=await moneyReadContext(actor,{...(f.branchId?{branchId:f.branchId}:{}),...(f.scope?{scope:f.scope}:{})});
 return db.$transaction(async tx=>{
  const loan=await tx.loan.findFirst({where:{id,companyId:actor.companyId,...(resolved.context.mode==="BRANCH"?{branchId:resolved.context.branchId}:{})}});
  if(!loan)throw new AuthorizationError();
  const base=Prisma.sql`SELECT j.id,j."entryDate",j."createdAt",j."journalNumber",j."sourceType",j.status,
   COALESCE(SUM(l.debit) FILTER (WHERE l."ledgerAccountId"=${loan.liabilityLedgerId}::uuid),0) AS debit,
   COALESCE(SUM(l.credit) FILTER (WHERE l."ledgerAccountId"=${loan.liabilityLedgerId}::uuid),0) AS credit,
   MAX(p.principal+p.interest+p.charges) AS payment
   FROM journal_entries j JOIN journal_lines l ON l."journalEntryId"=j.id AND l."companyId"=j."companyId"
   LEFT JOIN loan_payments p ON p."companyId"=j."companyId" AND p."loanId"=${id}::uuid AND (p."journalEntryId"=j.id OR p."journalEntryId"=j."reversalOfId")
   WHERE j."companyId"=${actor.companyId}::uuid AND j."branchId"=${loan.branchId}::uuid AND j.status IN ('POSTED','REVERSED')
   GROUP BY j.id HAVING BOOL_OR(l."ledgerAccountId"=${loan.liabilityLedgerId}::uuid) OR COUNT(p.id)>0`;
  const rows=await tx.$queryRaw<Row[]>(Prisma.sql`WITH postings AS (${base}),balances AS (SELECT *,SUM(credit-debit) OVER (ORDER BY "entryDate","createdAt",id) AS balance FROM postings) SELECT * FROM balances ORDER BY "entryDate","createdAt",id LIMIT ${f.limit} OFFSET ${f.offset}`);
  const [stats]=await tx.$queryRaw<Array<{total:bigint;balance:Prisma.Decimal;liabilityPostings:bigint}>>(Prisma.sql`WITH postings AS (${base}) SELECT COUNT(*) AS total,COALESCE(SUM(credit-debit),0) AS balance,COUNT(*) FILTER(WHERE debit<>0 OR credit<>0) AS "liabilityPostings" FROM postings`);
  return {loan,branchContext:resolved.context,total:Number(stats.total),offset:f.offset,limit:f.limit,outstanding:stats.liabilityPostings>BigInt(0)?stats.balance.toString():null,nextOffset:f.offset+rows.length<Number(stats.total)?f.offset+rows.length:null,rows:rows.map(row=>({...row,debit:row.debit.toString(),credit:row.credit.toString(),balance:row.balance.toString(),payment:row.payment?.toString()??null}))};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
