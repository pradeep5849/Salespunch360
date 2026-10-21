import {effectiveOrderTargetsInTx} from "./effective-targets";
import {assertOperationalWrite} from "@/lib/billing/entitlement";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission,canUsePermissionForMutation} from "@/lib/auth/permissions";
import {requireAccountModules} from "../modules";
import {authorizeProjectForCommercial,type ProjectActor} from "../projects";
import {inAccountTransaction} from "../transaction-scope";
import {orderQuantitySummary} from "./fulfilment";
async function authorizedOrder(tx:Prisma.TransactionClient,actor:ProjectActor,id:string,write=false){
 const company=await tx.company.findUniqueOrThrow({where:{id:actor.companyId},select:{productEdition:true}});
 if(!canUsePermission(actor,company.productEdition,"ACCOUNT_LEDGER_VIEW"))throw new AuthorizationError();
 const order=await tx.commercialDocument.findFirst({where:{id,companyId:actor.companyId,...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{}),type:{in:["SALES_ORDER","PURCHASE_ORDER"]}},include:{lines:{orderBy:{position:"asc"}}}});
 if(!order)throw new Error("NOT_FOUND");
 const sales=order.type==="SALES_ORDER";
 await requireAccountModules(actor,...(sales?["SALES","SALES_ORDER"] as const:["PURCHASES","PURCHASE_ORDER"] as const));
 if(write&&!canUsePermissionForMutation(actor,company.productEdition,sales?"ACCOUNT_SALES_ENTRY":"ACCOUNT_PURCHASE_ENTRY"))throw new AuthorizationError();
 if(order.projectId)await authorizeProjectForCommercial(actor,order.projectId,order.branchId,order.customerId??undefined,tx);
 return order;
}
export async function orderStateInTx(tx:Prisma.TransactionClient,actor:ProjectActor,id:string){
 const order=await authorizedOrder(tx,actor,id);
 const [allTargets,closed]=await Promise.all([
  tx.commercialDocument.findMany({where:{companyId:actor.companyId,...(order.type==="SALES_ORDER"?{sourceSalesOrderId:order.id}:{sourcePurchaseOrderId:order.id}),status:"POSTED",OR:[{journalEntryId:null},{journalEntry:{is:{status:"POSTED"}}}]},select:{id:true,lines:{select:{sourceOrderLineId:true,quantity:true,baseQuantity:true}}}}),
  tx.accountOperationalAudit.findFirst({where:{companyId:actor.companyId,entityType:"COMMERCIAL_DOCUMENT",entityId:order.id,eventType:"ORDER_REMAINING_CLOSED"},orderBy:{createdAt:"asc"},select:{createdAt:true}})
 ]);
 const targets=await effectiveOrderTargetsInTx(tx,actor.companyId,allTargets);
 const legacy=targets.some(t=>t.lines.some(l=>!l.sourceOrderLineId));
 const quantities=order.lines.length?orderQuantitySummary(order.lines,legacy?[]:targets.map(t=>({...t,status:"POSTED" as const,lines:t.lines.map(l=>({...l,sourceOrderLineId:l.sourceOrderLineId!}))})),Boolean(closed)):null;
 return{canClose:order.status==="POSTED"&&canUsePermissionForMutation(actor,"SALESPUNCH360_ACCOUNT",order.type==="SALES_ORDER"?"ACCOUNT_SALES_ENTRY":"ACCOUNT_PURCHASE_ENTRY"),orderId:order.id,type:order.type,documentStatus:order.status,status:order.status!=="POSTED"?order.status:closed?"CLOSED":legacy?"UNRESOLVED":quantities?.status??"UNRESOLVED",reason:closed?"MANUAL":legacy?"LEGACY_UNALLOCATED":quantities?.reason??"EMPTY_ORDER",closedAt:closed?.createdAt??null,lines:(legacy?[]:quantities?.lines??[]).map(line=>({...line,itemName:order.lines.find(source=>source.id===line.id)?.itemName??"Order line"})),note:legacy?"Historical invoices/bills have no source-line allocation. Quantity completion cannot be inferred from money or item names.":null};
}
export async function orderStateForActor(actor:ProjectActor,id:string){return db.$transaction(tx=>orderStateInTx(tx,actor,z.string().uuid().parse(id)),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead})}
export async function closeRemainingOrderForActor(actor:ProjectActor,raw:unknown){
 const {documentId,reason}=z.object({documentId:z.string().uuid(),reason:z.string().trim().min(1).max(1000)}).strict().parse(raw);
 await assertOperationalWrite(actor.companyId);
 return inAccountTransaction(undefined,async tx=>{
  await tx.$queryRaw`SELECT id FROM commercial_documents WHERE id=${documentId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const order=await authorizedOrder(tx,actor,documentId,true);
  if(order.status!=="POSTED")throw new Error("ORDER_NOT_CONFIRMED");
  const state=await orderStateInTx(tx,actor,documentId);
  if(state.status==="CLOSED")return state;
  await tx.accountOperationalAudit.create({data:{companyId:actor.companyId,actorUserId:actor.id,eventType:"ORDER_REMAINING_CLOSED",entityType:"COMMERCIAL_DOCUMENT",entityId:order.id,metadata:{reason,previousState:state.status,quantities:state.lines}}});
  return orderStateInTx(tx,actor,documentId);
 });
}
