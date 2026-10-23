import type {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
type Reader=Pick<Prisma.TransactionClient,"saleLifecycleSnapshot"|"serviceReminderCompletion">;
/** Preserve a completed reminder through an immutable, same-entitlement Sale
 * revision. An explicit server-recorded line binding is required; never infer
 * ownership/completion from matching item names or today's master data. */
export async function completedServiceReminderLines(companyId:string,documents:Array<{id:string;lines:Array<{id:string}>}>,reader:Reader=db){
 const current=documents.flatMap(row=>row.lines.map(line=>line.id));
 if(!current.length)return new Set<string>();
 const aliases=new Map<string,string>(),visited=new Set<string>();let frontier=[...new Set(documents.map(row=>row.id))];
 while(frontier.length){
  const next=new Set<string>();
  for(let position=0;position<frontier.length;position+=1000){
   const batch=frontier.slice(position,position+1000).filter(id=>!visited.has(id));if(!batch.length)continue;for(const id of batch)visited.add(id);
   const snapshots=await reader.saleLifecycleSnapshot.findMany({where:{companyId,state:"REVISED",replacementId:{in:batch}},select:{invoiceId:true,audit:{select:{metadata:true}}}});
   for(const row of snapshots){
    const metadata=row.audit.metadata as {retainedLineBindings?:unknown}|null,bindings=metadata?.retainedLineBindings;
    if(!Array.isArray(bindings))continue;
    for(const value of bindings){if(!value||typeof value!=="object")continue;const binding=value as {invoiceLineId?:unknown;sourceLineId?:unknown;inheritServiceCompletion?:unknown};if(binding.inheritServiceCompletion!==true||typeof binding.invoiceLineId!=="string"||typeof binding.sourceLineId!=="string")continue;const old=aliases.get(binding.invoiceLineId);if(old&&old!==binding.sourceLineId)throw new Error("INVALID_SERVICE_REMINDER_HISTORY");aliases.set(binding.invoiceLineId,binding.sourceLineId)}
    if(!visited.has(row.invoiceId))next.add(row.invoiceId);
   }
  }
  frontier=[...next];
 }
 const all=[...new Set([...current,...aliases.keys(),...aliases.values()])],completed=new Set<string>();
 for(let position=0;position<all.length;position+=1000){const rows=await reader.serviceReminderCompletion.findMany({where:{companyId,lineId:{in:all.slice(position,position+1000)}},select:{lineId:true}});for(const row of rows)completed.add(row.lineId)}
 const result=new Set<string>();
 for(const id of current){let next=id;const seen=new Set<string>();for(;;){if(completed.has(next)){result.add(id);break}if(seen.has(next))throw new Error("INVALID_SERVICE_REMINDER_HISTORY");seen.add(next);const parent=aliases.get(next);if(!parent)break;next=parent}}
 return result;
}
