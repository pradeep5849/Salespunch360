import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import type { ProjectActor } from "./projects";
import { createCommercialDocumentForActor, documentOutstandingInTx, postCommercialDocumentForActor } from "./commercial";
import { ensureOpenFinancialYearForDate } from "./financial-year";
import { retrySerializable } from "./transaction-retry";

async function editableSaleInTx(tx:Prisma.TransactionClient,actor:ProjectActor,id:string){
 await tx.$queryRaw`SELECT "id" FROM "commercial_documents" WHERE "id"=${id}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
 const sale=await tx.commercialDocument.findFirst({where:{id,companyId:actor.companyId},include:{lines:{orderBy:{position:"asc"}},adjustments:{where:{status:"POSTED"}},allocations:true,advanceApplications:true}});
 if(!sale||(actor.branchAccessScope==="SELECTED_BRANCHES"&&!actor.branchIds?.includes(sale.branchId)))throw new AuthorizationError();
 if(sale.type!=="SALES_INVOICE"||sale.status!=="POSTED"||!sale.partyId)throw new Error("SALE_NOT_EDITABLE");
 const financial=await documentOutstandingInTx(tx,actor.companyId,sale.id);
 if(!financial.outstanding.eq(sale.payableAmount??sale.grandTotal)||sale.adjustments.length||sale.allocations.length||sale.advanceApplications.length)throw new Error("SALE_HAS_PAYMENTS_OR_ADJUSTMENTS");
 return sale;
}
function creditPayload(sale:Awaited<ReturnType<typeof editableSaleInTx>>,date:string){
 return {type:"CREDIT_NOTE",branchId:sale.branchId,partyId:sale.partyId!,sourceDocumentId:sale.id,issueDate:date,taxMode:sale.taxMode,stateOfSupplyCode:sale.stateOfSupplyCode??undefined,freightAmount:sale.freightAmount.toString(),otherChargesAmount:sale.otherChargesAmount.toString(),roundOffAmount:sale.roundOffAmount.toString(),lines:sale.lines.map(line=>({lineType:line.lineType,sourceId:line.productId??line.serviceId??line.workPackageId??undefined,itemName:line.itemName,itemCode:line.itemCode??undefined,description:line.description??undefined,specification:line.specification??undefined,unitName:line.unitName??undefined,unitSymbol:line.unitSymbol??undefined,quantity:line.quantity.toString(),rate:line.rate.toString(),discountType:line.discountType??undefined,discountValue:line.discountValue?.toString()??undefined,taxRate:line.taxRate.toString(),cessRate:line.cessRate.toString(),warehouseId:line.warehouseId??undefined,batchId:line.batchId??undefined,serialNumberId:line.serialNumberId??undefined,stockReturnQuantity:line.quantity.toString(),sourceCommercialLineId:line.id}))};
}
function businessToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
async function creditInTx(tx:Prisma.TransactionClient,actor:ProjectActor,sale:Awaited<ReturnType<typeof editableSaleInTx>>){
 const date=businessToday();await ensureOpenFinancialYearForDate(actor.companyId,new Date(date),tx);
 const credit=await createCommercialDocumentForActor(actor,creditPayload(sale,date),tx);
 await postCommercialDocumentForActor(actor,{documentId:credit.id},tx);
 const financial=await documentOutstandingInTx(tx,actor.companyId,sale.id);
 if(!financial.outstanding.isZero())throw new Error("SALE_REVERSAL_INCOMPLETE");
 return credit;
}
export function reversePostedSaleForActor(actor:ProjectActor,id:string){
 return retrySerializable(()=>db.$transaction(async tx=>creditInTx(tx,actor,await editableSaleInTx(tx,actor,id)),{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000}));
}
export function replacePostedSaleForActor(actor:ProjectActor,id:string,raw:unknown){
 return retrySerializable(()=>db.$transaction(async tx=>{
  const sale=await editableSaleInTx(tx,actor,id);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("INVALID_INPUT");
  const payload:Record<string,unknown>={...(raw as Record<string,unknown>),type:"SALES_INVOICE"};
  if(payload.branchId!==sale.branchId)throw new Error("INVALID_BRANCH");
  // Clients may omit hidden header fields; preserve their invoice snapshots.
  const headerDefaults:Record<string,unknown>={billingName:sale.billingName??undefined,customerPoNumber:sale.customerPoNumber??undefined,customerPoDate:sale.customerPoDate?.toISOString().slice(0,10),transactionTime:sale.transactionTime??undefined,ewayBillNumber:sale.ewayBillNumber??undefined,notes:sale.notes??undefined,dueDate:sale.dueDate?.toISOString().slice(0,10),projectId:sale.projectId??undefined,projectReference:sale.projectReference??undefined,reverseCharge:sale.reverseCharge,taxMode:sale.taxMode,stateOfSupplyCode:sale.stateOfSupplyCode??undefined,freightAmount:sale.freightAmount.toString(),otherChargesAmount:sale.otherChargesAmount.toString(),roundOffAmount:sale.roundOffAmount.toString(),tdsRate:sale.taxableTotal.isZero()?"0":sale.tdsAmount.mul(100).div(sale.taxableTotal).toString(),tcsRate:sale.taxableTotal.isZero()?"0":sale.tcsAmount.mul(100).div(sale.taxableTotal).toString()};
  for(const [key,value] of Object.entries(headerDefaults))if(payload[key]===undefined)payload[key]=value;

  if(payload.customFields===undefined){const values=await tx.customFieldValue.findMany({where:{companyId:actor.companyId,entityType:"SALES_INVOICE",entityId:sale.id,definition:{isActive:true}},include:{definition:{select:{fieldKey:true}}}});payload.customFields=Object.fromEntries(values.map(row=>[row.definition.fieldKey,typeof row.value==="string"?row.value:JSON.stringify(row.value)]));}
  delete payload.receivedAmount;delete payload.receivedInFull;delete payload.paymentType;
  const replacement=await createCommercialDocumentForActor(actor,payload,tx);
  if(replacement.id===sale.id||replacement.status!=="DRAFT")throw new Error("SALE_REPLACEMENT_ALREADY_POSTED");
  await ensureOpenFinancialYearForDate(actor.companyId,replacement.issueDate,tx);
  // The full credit returns stock before a replacement reuses a batch or serial.
  // Both postings and all journals/stock movements commit or roll back together.
  await creditInTx(tx,actor,sale);
  await postCommercialDocumentForActor(actor,{documentId:replacement.id},tx);
  return replacement;
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000}));
}
