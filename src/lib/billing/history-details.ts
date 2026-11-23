import {db} from '@/lib/db';
export const paymentDetailSelect={id:true,provider:true,providerPaymentId:true,manualReference:true,amount:true,currency:true,status:true,createdAt:true,capturedAt:true} as const;
export async function orderTelecallerTargets(companyId:string,orderIds:string[]){
 const result=new Map<string,number>();if(!orderIds.length)return result;
 const markers=await db.billingAuditEvent.findMany({where:{companyId,entityId:{in:orderIds},type:'ORDER_CREATED',reason:'UNIFIED_TELECALLER_TARGET'},orderBy:[{occurredAt:'desc'},{id:'desc'}],select:{entityId:true,metadata:true}});
 const seen=new Set<string>();
 for(const marker of markers){if(!marker.entityId)continue;if(seen.has(marker.entityId))continue;seen.add(marker.entityId);const metadata=marker.metadata;const value=metadata&&typeof metadata==='object'&&!Array.isArray(metadata)?metadata.telecallerSeats:undefined;if(typeof value==='number'&&Number.isInteger(value)&&value>=0)result.set(marker.entityId,value)}
 return result;
}
