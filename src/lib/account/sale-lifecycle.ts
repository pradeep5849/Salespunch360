import type {Prisma} from "@prisma/client";
type Reader=Pick<Prisma.TransactionClient,"accountOperationalAudit"|"saleLifecycleSnapshot">;
type Lifecycle={lifecycle:"CANCELLED"|"REVISED";replacementId?:string};
/** Call only with company/branch-authorized invoice IDs. New corrections have an
 * immutable indexed state. Older invoices use their original bounded audit
 * history; migration never guesses or rewrites a historical posted invoice. */
export async function saleLifecycleEvents(reader:Reader,companyId:string,ids:string[]){
 const result=new Map<string,Lifecycle>();
 if(!ids.length)return result;
 const snapshots=await reader.saleLifecycleSnapshot.findMany({where:{companyId,invoiceId:{in:ids}},select:{invoiceId:true,state:true,replacementId:true}});
 for(const row of snapshots){
  if(row.state!=="CANCELLED"&&row.state!=="REVISED")throw new Error("SALE_RETURN_HISTORY_INCONSISTENT");
  result.set(row.invoiceId,{lifecycle:row.state,...(row.replacementId?{replacementId:row.replacementId}:{})});
 }
 const missing=ids.filter(id=>!result.has(id));
 if(!missing.length)return result;
 const events=await reader.accountOperationalAudit.findMany({where:{companyId,entityType:"SALES_INVOICE",entityId:{in:missing},eventType:{in:["SALE_AMENDED","SALE_REVERSED"]}},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{entityId:true,eventType:true,metadata:true}});
 for(const event of events){
  const id=(event.metadata as {replacementId?:unknown}|null)?.replacementId;
  const lifecycle:Lifecycle={lifecycle:event.eventType==="SALE_REVERSED"?"CANCELLED":"REVISED",...(event.eventType==="SALE_AMENDED"&&typeof id==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)?{replacementId:id}:{})};
  const previous=result.get(event.entityId);
  if(previous&&(previous.lifecycle!==lifecycle.lifecycle||previous.replacementId!==lifecycle.replacementId))throw new Error("SALE_RETURN_HISTORY_INCONSISTENT");
  result.set(event.entityId,lifecycle);
 }
 return result;
}
