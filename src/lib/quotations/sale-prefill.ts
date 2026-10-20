import type {SaleDraftInitial} from "@/lib/account/sale-duplicate";
import type {quotationConversionPreviewForActor} from "./conversion-preview";
export type QuotationConversionPreview=Awaited<ReturnType<typeof quotationConversionPreviewForActor>>;
/** Unsaved form state only. Long estimate reference text is retained separately;
 * warehouse, serial, receipt and document identities must be selected afresh. */
export function quotationSalePrefill(preview:QuotationConversionPreview,issueDate:string):SaleDraftInitial{
 if(preview.targetType!=="SALES_INVOICE")throw new Error("INVALID_QUOTATION_CONVERSION_TARGET");
 return {
  sourceQuotationRevisionId:preview.sourceRevisionId,
  quotationReference:{documentId:preview.sourceDocumentId,number:preview.sourceNumber,...preview.reference},
  branchId:preview.branchId,partyId:preview.partyId,projectId:preview.projectId??undefined,
  issueDate,taxMode:preview.taxMode,billingName:preview.billingName??undefined,stateOfSupplyCode:preview.stateOfSupplyCode,
  roundOffAmount:preview.roundOffAmount,reverseCharge:false,freightAmount:"0",otherChargesAmount:"0",tdsRate:"0",tcsRate:"0",
  lines:preview.lines.map(line=>({
   ...line,sourceId:line.sourceId??"",description:line.description??"",specification:line.specification??"",
   unitName:line.unitName??"",unitSymbol:line.unitSymbol??"",cessRate:"0",warehouseId:"",batchId:"",serialNumberId:"",
   stockReturnQuantity:"0",sourceCommercialLineId:"",purchaseAllocations:[],
   // Quotation labels carry no historical stock conversion snapshot. Require an
   // explicit current item-unit/warehouse review before a real Sale is saved.
   quotationUnitReviewRequired:line.lineType==="PRODUCT",
  })),
 };
}
