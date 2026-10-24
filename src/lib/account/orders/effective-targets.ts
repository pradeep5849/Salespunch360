import type {Prisma} from "@prisma/client";
/** Explicit sale correction events retire the original fulfilment; ordinary return notes
 * are not guessed to be replacement orders. Posted-document history remains intact. */
export async function effectiveOrderTargetsInTx<T extends {id:string}>(tx:Prisma.TransactionClient,companyId:string,targets:T[]){
 if(!targets.length)return targets;
 const corrections=await tx.accountOperationalAudit.findMany({where:{companyId,entityType:"SALES_INVOICE",entityId:{in:targets.map(t=>t.id)},eventType:{in:["SALE_AMENDED","SALE_REVERSED"]}},select:{entityId:true}});
 const retired=new Set(corrections.map(c=>c.entityId));return targets.filter(t=>!retired.has(t.id));
}
