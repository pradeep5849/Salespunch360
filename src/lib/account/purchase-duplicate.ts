import type {getCommercialDocumentForActor} from "./commercial";
import type {SaleDraftInitial} from "./sale-duplicate";
import {parseCommercialUnitSnapshot} from "./commercial-unit-snapshot";
import {retainedLineDiscountValue} from "./retained-line-discount";
/** Prepare inputs only. No source allocations, journal, stock, cash or supplier bill identity is copied. */
export function purchaseDuplicateDraft(source:Awaited<ReturnType<typeof getCommercialDocumentForActor>>,date:string):SaleDraftInitial {
 if(source.type!=="PURCHASE_BILL"||!source.partyId)throw new Error("PURCHASE_DUPLICATE_UNAVAILABLE");
 return {branchId:source.branchId,partyId:source.partyId,issueDate:date,taxMode:source.taxMode,reverseCharge:source.reverseCharge,roundOffAmount:"0",freightAmount:source.freightAmount.toString(),otherChargesAmount:source.otherChargesAmount.toString(),tdsRate:"0",tcsRate:"0",billingName:source.billingName??undefined,notes:source.notes??undefined,purchasePurpose:source.purchasePurpose??"INVENTORY_SALES",purchaseClassification:source.purchaseClassification??"PURCHASE_COST",projectId:source.projectId??undefined,materialTreatment:source.materialTreatment??undefined,stateOfSupplyCode:source.stateOfSupplyCode??undefined,
 lines:source.lines.map(line=>{
  const selected=line.unitConversionSnapshot?parseCommercialUnitSnapshot(line.unitConversionSnapshot).selection:"PRIMARY";
  return {lineType:line.lineType,sourceId:line.productId??line.serviceId??line.workPackageId??"",itemName:line.itemName,itemCode:line.itemCode??undefined,description:line.description??"",specification:line.specification??"",unitName:line.unitName??"",unitSymbol:line.unitSymbol??"",unitSelection:selected,quotationUnitReviewRequired:line.lineType!=="CUSTOM",quantity:line.quantity.toString(),rate:line.rate.toString(),discountType:line.discountType??"",discountValue:retainedLineDiscountValue(line)??"0",taxRate:line.taxRate.toString(),cessRate:line.cessRate.toString(),warehouseId:"",batchId:"",serialNumberId:"",stockReturnQuantity:"0",sourceCommercialLineId:"",purchaseAllocations:[]};
 })};
}
/** Review-only preparation for the existing debit-note lifecycle; does not cancel the bill. */
export function purchaseReturnDraft(source:Awaited<ReturnType<typeof getCommercialDocumentForActor>>,date:string):SaleDraftInitial {
 if(source.type!=="PURCHASE_BILL"||source.status!=="POSTED")throw new Error("PURCHASE_RETURN_UNAVAILABLE");
 const draft=purchaseDuplicateDraft(source,date);
 return {...draft,sourceDocumentId:source.id,freightAmount:"0",otherChargesAmount:"0",notes:`Correction of ${source.documentNumber}. Review quantities, tax and physical stock return before saving.`,lines:draft.lines.map((line,index)=>({...line,sourceCommercialLineId:source.lines[index].id,quotationUnitReviewRequired:false,unitConversionSnapshot:source.lines[index].unitConversionSnapshot?parseCommercialUnitSnapshot(source.lines[index].unitConversionSnapshot):undefined,stockReturnQuantity:"0"}))};
}
