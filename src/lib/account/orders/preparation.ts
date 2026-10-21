import {Prisma} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {AuthorizationError,requirePermission} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import type {ProjectActor} from "../projects";
import type {SaleDraftInitial} from "../sale-duplicate";
import {parseCommercialUnitSnapshot} from "../commercial-unit-snapshot";
import {retainedLineDiscountValue} from "../retained-line-discount";
import {authorizedOrder,orderStateInTx} from "./lifecycle";
/** Read-only form preparation. Save performs fresh source authorization and quantity checks. */
export async function orderSalePreparationForActor(actor:ProjectActor,id:string):Promise<SaleDraftInitial>{
 z.string().uuid().parse(id);
 if(!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_SALES_ENTRY")||!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_JOURNAL_POST"))throw new AuthorizationError();
 return db.$transaction(async tx=>{
  const order=await authorizedOrder(tx,actor,id),state=await orderStateInTx(tx,actor,id);
  if(order.type!=="SALES_ORDER"||order.status!=="POSTED"||state.status!=="OPEN")throw new Error("ORDER_NOT_OPEN");
  if(!order.customerId)throw new Error("ORDER_PARTY_UNAVAILABLE");
  const [branch,customer]=await Promise.all([tx.branch.findFirst({where:{id:order.branchId,companyId:actor.companyId,isActive:true},select:{id:true}}),tx.customer.findFirst({where:{id:order.customerId,companyId:actor.companyId,branchId:order.branchId,isActive:true,isAccountCustomer:true},select:{id:true}})]);
  if(!branch||!customer)throw new Error("ORDER_PARTY_UNAVAILABLE");
  const lines:SaleDraftInitial["lines"]=[];
  for(const source of order.lines){
   const balance=state.lines.find(l=>l.id===source.id);if(!balance||new Prisma.Decimal(balance.remaining).isZero())continue;
   const snapshot=source.unitConversionSnapshot?parseCommercialUnitSnapshot(source.unitConversionSnapshot):undefined;
   const quantity=new Prisma.Decimal(balance.remaining).mul(snapshot?.selection==="SECONDARY"?snapshot.secondaryUnitsPerBase:1);
   if(quantity.decimalPlaces()>4)throw new Error("ORDER_UNIT_REVIEW_REQUIRED");
   lines.push({sourceOrderLineId:source.id,lineType:source.lineType,sourceId:source.productId??source.serviceId??source.workPackageId??"",itemName:source.itemName,itemCode:source.itemCode??undefined,description:source.description??"",specification:source.specification??"",unitName:source.unitName??"",unitSymbol:source.unitSymbol??"",unitSelection:snapshot?.selection??"PRIMARY",unitConversionSnapshot:snapshot,quantity:quantity.toString(),rate:source.rate.toString(),discountType:source.discountType??"",discountValue:retainedLineDiscountValue(source)??"0",taxRate:source.taxRate.toString(),cessRate:source.cessRate.toString(),warehouseId:"",batchId:"",serialNumberId:"",stockReturnQuantity:"0",sourceCommercialLineId:"",purchaseAllocations:[]});
  }
  if(!lines.length)throw new Error("ORDER_NOT_OPEN");
  return{sourceSalesOrderId:order.id,orderNumber:order.documentNumber,branchId:order.branchId,partyId:order.partyId,projectId:order.projectId??undefined,issueDate:new Date().toISOString().slice(0,10),billingName:order.billingName??undefined,taxMode:order.taxMode,stateOfSupplyCode:order.stateOfSupplyCode??undefined,reverseCharge:order.reverseCharge,roundOffAmount:"0",freightAmount:"0",otherChargesAmount:"0",tdsRate:"0",tcsRate:"0",notes:order.notes??undefined,lines};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
export async function orderSalePreparation(id:string){return orderSalePreparationForActor((await requirePermission("ACCOUNT_SALES_ENTRY")) as ProjectActor,id)}
