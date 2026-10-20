import {parseCommercialUnitSnapshot} from "./commercial-unit-snapshot";
import {retainedLineDiscountValue} from "./retained-line-discount";
import type {getCommercialDocumentForActor} from "./commercial";
import type {SaleEditInitial} from "./sale-edit-initial";
export type SaleDraftInitial=Omit<SaleEditInitial,"id"|"documentNumber">&{copiedFromSaleId?:string;sourceQuotationRevisionId?:string;quotationReference?:{documentId:string;number:string;terms:string|null;inclusions:string|null;exclusions:string|null;notes:string|null;paymentSchedule:Array<{label:string;amount:string;dueDescription:string|null}>}};
type Source=Awaited<ReturnType<typeof getCommercialDocumentForActor>>;
/** New-document input retains only recheckable IDs for selected-unit provenance.
 * Posting, receipts, return links, serial assignment and stock movements are never copied. */
export function saleDuplicateDraft(source:Source,issueDate:string):SaleDraftInitial{
 if(source.type!=="SALES_INVOICE"||!source.partyId)throw new Error("SALE_DUPLICATE_UNAVAILABLE");
 return {
  ...(source.lines.some(line=>(line.unitConversionSnapshot as {selection?:string}|null)?.selection==="SECONDARY")?{copiedFromSaleId:source.id}:{}),
  branchId:source.branchId,partyId:source.partyId,issueDate,taxMode:source.taxMode,reverseCharge:source.reverseCharge,
  roundOffAmount:"0",freightAmount:source.freightAmount.toString(),otherChargesAmount:source.otherChargesAmount.toString(),
  tdsRate:source.taxableTotal.isZero()?"0":source.tdsAmount.mul(100).div(source.taxableTotal).toString(),tcsRate:source.taxableTotal.isZero()?"0":source.tcsAmount.mul(100).div(source.taxableTotal).toString(),
  billingName:source.billingName??undefined,shippingAddress:source.shippingAddress??"",notes:source.notes??undefined,projectId:source.projectId??undefined,stateOfSupplyCode:source.stateOfSupplyCode??undefined,customValues:structuredClone(source.customValues),
  lines:source.lines.map(line=>({unitConversionSnapshot:line.unitConversionSnapshot?parseCommercialUnitSnapshot(line.unitConversionSnapshot):undefined,...((line.unitConversionSnapshot as {selection?:string}|null)?.selection==="SECONDARY"?{copiedFromSaleLineId:line.id}:{}),lineType:line.lineType,sourceId:line.productId??line.serviceId??line.workPackageId??"",itemName:line.itemName,itemCode:line.itemCode??undefined,description:line.description??"",specification:line.specification??"",unitName:line.unitName??"",unitSymbol:line.unitSymbol??"",quantity:line.quantity.toString(),rate:line.rate.toString(),discountType:line.discountType??"",discountValue:retainedLineDiscountValue(line)??"0",taxRate:line.taxRate.toString(),cessRate:line.cessRate.toString(),warehouseId:line.warehouseId??"",batchId:"",serialNumberId:"",servicePeriodDays:line.servicePeriodDays===null?undefined:String(line.servicePeriodDays),stockReturnQuantity:"0",sourceCommercialLineId:"",purchaseAllocations:[]})),
 };
}
