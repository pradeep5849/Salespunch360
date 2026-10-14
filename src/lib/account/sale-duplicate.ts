import type {getCommercialDocumentForActor} from "./commercial";
import type {SaleEditInitial} from "./sale-edit-initial";
export type SaleDraftInitial=Omit<SaleEditInitial,"id"|"documentNumber">;
type Source=Awaited<ReturnType<typeof getCommercialDocumentForActor>>;
/** Explicit new-document input only: no original identity, posting, receipts,
 * return links, serial assignment or stock movements cross into the draft. */
export function saleDuplicateDraft(source:Source,issueDate:string):SaleDraftInitial{
 if(source.type!=="SALES_INVOICE"||!source.partyId)throw new Error("SALE_DUPLICATE_UNAVAILABLE");
 return {
  branchId:source.branchId,partyId:source.partyId,issueDate,taxMode:source.taxMode,reverseCharge:source.reverseCharge,
  roundOffAmount:"0",freightAmount:source.freightAmount.toString(),otherChargesAmount:source.otherChargesAmount.toString(),
  tdsRate:source.taxableTotal.isZero()?"0":source.tdsAmount.mul(100).div(source.taxableTotal).toString(),tcsRate:source.taxableTotal.isZero()?"0":source.tcsAmount.mul(100).div(source.taxableTotal).toString(),
  billingName:source.billingName??undefined,notes:source.notes??undefined,projectId:source.projectId??undefined,stateOfSupplyCode:source.stateOfSupplyCode??undefined,customValues:structuredClone(source.customValues),
  lines:source.lines.map(line=>({lineType:line.lineType,sourceId:line.productId??line.serviceId??line.workPackageId??"",itemName:line.itemName,itemCode:line.itemCode??undefined,description:line.description??"",specification:line.specification??"",unitName:line.unitName??"",unitSymbol:line.unitSymbol??"",quantity:line.quantity.toString(),rate:line.rate.toString(),discountType:line.discountType??"",discountValue:line.discountValue?.toString()??"0",taxRate:line.taxRate.toString(),cessRate:line.cessRate.toString(),warehouseId:line.warehouseId??"",batchId:"",serialNumberId:"",servicePeriodDays:line.servicePeriodDays===null?undefined:String(line.servicePeriodDays),stockReturnQuantity:"0",sourceCommercialLineId:"",purchaseAllocations:[]})),
 };
}
