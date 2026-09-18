import type {AccountRole,Prisma} from '@prisma/client';
import {suspendAccountAccessInTransaction} from '@/lib/auth/lifecycle';
import {ACCOUNT_PACKAGE_ROLES} from './account-package';

/** Applies Account package reductions only at the new term boundary. Oldest users are retained; newest are suspended first. */
export async function applyAccountPackageReduction(tx:Prisma.TransactionClient,companyId:string,packageCount:number){
 const suspended:string[]=[];
 for(const role of ACCOUNT_PACKAGE_ROLES as readonly AccountRole[]){
  const users=await tx.user.findMany({where:{companyId,isActive:true,accountAccessActive:true,accountRole:role},select:{id:true,createdAt:true},orderBy:[{createdAt:'asc'},{id:'asc'}]});
  for(const user of users.slice(Math.max(0,packageCount))){await suspendAccountAccessInTransaction(tx,user.id);suspended.push(user.id)}
 }
 return suspended;
}
