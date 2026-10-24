import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {requireAccountModules} from "../modules";
import {postedPartyBalances} from "../posted-party-balances";
import type {FinancialReportContext,ReportResult} from "./service";
const D=Prisma.Decimal.clone({precision:48});
export async function allPartiesReport(c:FinancialReportContext):Promise<ReportResult>{
 if(!c.actor.companyId||!canUsePermission(c.actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_LEDGER_VIEW"))throw new AuthorizationError();
 await requireAccountModules(c.actor,"SALES","PURCHASES");
 const companyId=c.actor.companyId,branches=c.f.branchId?[c.f.branchId]:c.actor.branchAccessScope==="SELECTED_BRANCHES"?c.actor.branchIds??[]:undefined;
 return db.$transaction(async tx=>{
  const entries:Array<{id:string;name:string;customer:boolean;balance:Prisma.Decimal}>=[];
  for(const customer of [true,false]){
   let cursor:string|undefined;
   for(;;){
    const paging={select:{id:true,name:true},orderBy:{id:"asc" as const},take:1000,...(cursor?{cursor:{id:cursor},skip:1}:{})};
    const rows=customer?await tx.customer.findMany({...paging,where:{companyId,isAccountCustomer:true,...(branches?{branchId:{in:branches}}:{})}}):await tx.vendor.findMany({...paging,where:{companyId}});
    const balances=await postedPartyBalances({companyId,partyIds:rows.map(row=>row.id),customer,branches,asOf:c.to},tx);
    entries.push(...rows.map(row=>({...row,customer,balance:balances.get(row.id)??new D(0)})));
    if(rows.length<1000)break;cursor=rows[rows.length-1].id;
   }
  }
  entries.sort((a,b)=>a.name.localeCompare(b.name)||Number(b.customer)-Number(a.customer)||a.id.localeCompare(b.id));
  const totals=Array.from({length:4},()=>new D(0));
  const rows=entries.map(row=>{const values=Array.from({length:4},()=>new D(0));values[row.customer?(row.balance.gte(0)?0:2):(row.balance.gte(0)?1:3)]=row.balance.abs();values.forEach((value,index)=>{totals[index]=totals[index].add(value)});return[row.name,row.customer?"Customer":"Vendor",...values.map(value=>value.toFixed(2))]});
  const labels=["Receivable","Payable","Customer Advance","Vendor Advance"];
  return{title:"All Parties Report",columns:["Party","Party Type",...labels],rows,totals:["Total","",...totals.map(value=>value.toFixed(2))],summary:labels.map((label,index)=>({label,value:totals[index].toFixed(2),money:true})),note:`Closing balances through ${c.to.toISOString().slice(0,10)}; the start date does not limit opening history. Includes inactive accounting customers and vendors, with zero balances shown. Customer profiles follow the selected authorized branch scope; vendor profiles are shared within the company, while all balances use only authorized selected branches. Current party names; separate customer/vendor identities even when names match. Posted journal history, dated reversals, opening balances, receipts and advances are counted once. Customer and vendor advances are separate; they are not income or expense. Legacy posted documents without journals retain their existing balance treatment. No financial writes.`};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
