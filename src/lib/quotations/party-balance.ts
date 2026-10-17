import {Prisma} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {requireAccountModules} from "@/lib/account/modules";
import {currentPartyBalanceForActor} from "@/lib/account/party-balance";
import type {ProjectActor} from "@/lib/account/projects";
export const quotationPartyBalanceInput=z.object({partyId:z.string().uuid(),branchId:z.string().uuid()}).strict();
/** Same posted/opening/receipt/advance definition as Sale Details, within authorized branches. */
export async function quotationPartyBalanceForActor(actor:ProjectActor,raw:unknown){
 if(!actor.companyId||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_QUOTATION_VIEW")||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_LEDGER_VIEW")||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_ACCOUNTS"))throw new AuthorizationError();
 const input=quotationPartyBalanceInput.parse(raw);
 if(actor.branchAccessScope==="SELECTED_BRANCHES"&&!actor.branchIds?.includes(input.branchId))throw new AuthorizationError();
 await requireAccountModules(actor,"QUOTATIONS_BOQ");
 return db.$transaction(async tx=>{
  const branch=await tx.branch.findFirst({where:{id:input.branchId,companyId:actor.companyId},select:{id:true}});
  if(!branch)throw new AuthorizationError();
  const party=await tx.customer.findFirst({where:{id:input.partyId,companyId:actor.companyId,branchId:input.branchId,isAccountCustomer:true},select:{id:true}});
  if(!party)throw new AuthorizationError();
  const balance=await currentPartyBalanceForActor(actor,party.id,true,tx);
  return {...input,balance};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
