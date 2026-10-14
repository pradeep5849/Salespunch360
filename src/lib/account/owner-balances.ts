import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {sumPersistedMoney} from "./money-sum";
import type {ProjectActor} from "./projects";
export type OwnerBalanceSource={id:string;capitalLedgerId:string;drawingsLedgerId:string;loanLedgerId:string};
export type OwnerBalances={capital:string;drawings:string;loan:string};
/** Batch current owner financing balances in the same scope as the money list. */
export async function ownerBalancesForActor(actor:ProjectActor,owners:readonly OwnerBalanceSource[]):Promise<Record<string,OwnerBalances>>{
 if(!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_MONEY_VIEW"))throw new AuthorizationError();
 if(!owners.length)return {};
 const balances=await db.journalLine.groupBy({by:["ledgerAccountId"],where:{companyId:actor.companyId,ledgerAccountId:{in:[...new Set(owners.flatMap(owner=>[owner.capitalLedgerId,owner.drawingsLedgerId,owner.loanLedgerId]))]},journalEntry:{companyId:actor.companyId,status:{in:["POSTED","REVERSED"]},...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{})}},_sum:{debit:true,credit:true}});
 const byLedger=new Map(balances.map(row=>[row.ledgerAccountId,row]));
 const net=(id:string,debit=false)=>{const row=byLedger.get(id);return sumPersistedMoney([new Prisma.Decimal((debit?row?._sum.debit:row?._sum.credit)??0),new Prisma.Decimal((debit?row?._sum.credit:row?._sum.debit)??0).negated()])};
 return Object.fromEntries(owners.map(owner=>[owner.id,{capital:net(owner.capitalLedgerId),drawings:net(owner.drawingsLedgerId,true),loan:net(owner.loanLedgerId)}]));
}
