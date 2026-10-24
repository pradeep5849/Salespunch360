import {effectiveOrderTargetsInTx} from "./effective-targets";
import {Prisma} from "@prisma/client";
import {orderQuantitySummary} from "./fulfilment";
type Target={id?:string;companyId:string;branchId:string;type:string;customerId?:string|null;vendorId?:string|null;projectId?:string|null;sourcePurchaseOrderId?:string|null;sourceSalesOrderId?:string|null;lines:{sourceOrderLineId?:string|null;quantity:Prisma.Decimal;baseQuantity?:Prisma.Decimal|null;productId?:string|null;serviceId?:string|null;workPackageId?:string|null;itemName:string}[]};
/** Lock the source order before admitting another posted fulfilment. Caller owns transaction/authorization. */
export async function validateOrderFulfilmentInTx(tx:Prisma.TransactionClient,target:Target,replacingSaleId?:string){
 const orderId=target.sourceSalesOrderId??target.sourcePurchaseOrderId;
 const mapped=target.lines.some(l=>l.sourceOrderLineId);
 if(!orderId){if(mapped)throw new Error("SOURCE_ORDER_REQUIRED");return}
 if(target.sourceSalesOrderId&&target.sourcePurchaseOrderId)throw new Error("AMBIGUOUS_SOURCE_ORDER");
 const sales=Boolean(target.sourceSalesOrderId);
 if(target.type!==(sales?"SALES_INVOICE":"PURCHASE_BILL"))throw new Error("INVALID_ORDER_TARGET_TYPE");
 // Preserve historical unallocated purchase-bill behavior until its original lines can be identified.
 if(!sales&&!mapped)return;
 if(target.lines.some(l=>!l.sourceOrderLineId))throw new Error("SOURCE_ORDER_LINE_REQUIRED");
 await tx.$queryRaw`SELECT id FROM commercial_documents WHERE id=${orderId}::uuid AND "companyId"=${target.companyId}::uuid FOR UPDATE`;
 const order=await tx.commercialDocument.findFirst({where:{id:orderId,companyId:target.companyId,type:sales?"SALES_ORDER":"PURCHASE_ORDER",status:"POSTED"},include:{lines:true}});
 if(!order||order.branchId!==target.branchId||order.customerId!==(target.customerId??null)||order.vendorId!==(target.vendorId??null)||order.projectId!==(target.projectId??null))throw new Error("INVALID_SOURCE_ORDER");
 if(await tx.accountOperationalAudit.findFirst({where:{companyId:target.companyId,entityType:"COMMERCIAL_DOCUMENT",entityId:order.id,eventType:"ORDER_REMAINING_CLOSED"},select:{id:true}}))throw new Error("ORDER_MANUALLY_CLOSED");
 for(const line of target.lines){const source=order.lines.find(s=>s.id===line.sourceOrderLineId);if(!source||source.productId!==(line.productId??null)||source.serviceId!==(line.serviceId??null)||source.workPackageId!==(line.workPackageId??null)||(!source.productId&&!source.serviceId&&!source.workPackageId&&source.itemName!==line.itemName))throw new Error("INVALID_SOURCE_ORDER_LINE")}
 const prior=await effectiveOrderTargetsInTx(tx,target.companyId,await tx.commercialDocument.findMany({where:{companyId:target.companyId,...(sales?{sourceSalesOrderId:orderId}:{sourcePurchaseOrderId:orderId}),...((target.id||replacingSaleId)?{id:{notIn:[target.id,replacingSaleId].filter((id):id is string=>Boolean(id))}}:{}),status:"POSTED",OR:[{journalEntryId:null},{journalEntry:{is:{status:"POSTED"}}}]},include:{lines:true}}));
 if(prior.some(d=>d.lines.some(l=>!l.sourceOrderLineId)))throw new Error("ORDER_LEGACY_FULFILMENT_UNALLOCATED");
 orderQuantitySummary(order.lines,[...prior.map(d=>({id:d.id,status:"POSTED" as const,lines:d.lines.map(l=>({...l,sourceOrderLineId:l.sourceOrderLineId!}))})),{id:target.id??"new",status:"POSTED",lines:target.lines.map(l=>({...l,sourceOrderLineId:l.sourceOrderLineId!}))}]);
}
