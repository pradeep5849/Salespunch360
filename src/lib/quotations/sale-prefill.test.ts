import {describe,it,expect} from "vitest";
import {quotationSalePrefill,quotationOrderPrefill,type QuotationConversionPreview} from "./sale-prefill";
const preview={sourceDocumentId:"estimate",sourceRevisionId:"revision",sourceRevisionNumber:2,sourceNumber:"EST-22",sourceStatus:"APPROVED",targetType:"SALES_INVOICE",branchId:"branch",partyId:"customer",projectId:null,billingName:"Buyer billing",stateOfSupplyCode:"29",taxMode:"INCLUSIVE",roundOffAmount:"-0.40",taxableTotal:"100",taxTotal:"18",grandTotal:"117.60",reference:{terms:"Long terms".repeat(1000),inclusions:"Included",exclusions:"Excluded",notes:"Estimate reference",paymentSchedule:[{label:"Deposit",amount:"40.00",dueDescription:"On acceptance"}]},lines:[{lineType:"PRODUCT",sourceId:"product",itemName:"Steel",unitName:"Box",unitSymbol:"box",quantity:"2",rate:"59",discountType:"FIXED",discountValue:"0",taxRate:"18"},{lineType:"CUSTOM",itemName:"Delivery",quantity:"1",rate:"0",discountType:"FIXED",discountValue:"0",taxRate:"0"}]} as QuotationConversionPreview;
describe("read-only quotation to Add Sale form",()=>{
 it("retains approved financial values and full reference without manufacturing a sale identity",()=>{
  const draft=quotationSalePrefill(preview,"2026-10-20");
  expect(draft).toMatchObject({sourceQuotationRevisionId:"revision",branchId:"branch",partyId:"customer",issueDate:"2026-10-20",taxMode:"INCLUSIVE",roundOffAmount:"-0.40",billingName:"Buyer billing",stateOfSupplyCode:"29"});
  expect(draft.quotationReference?.terms).toBe(preview.reference.terms);expect(draft.quotationReference?.paymentSchedule).toEqual(preview.reference.paymentSchedule);
  for(const key of ["id","documentNumber","notes","receivedAmount","journalEntryId"])expect(draft).not.toHaveProperty(key);
 });
 it("requires explicit physical unit review and copies no stock/payment history",()=>{
  const draft=quotationSalePrefill(preview,"2026-10-20");
  expect(draft.lines[0]).toMatchObject({sourceId:"product",quantity:"2",rate:"59",unitName:"Box",quotationUnitReviewRequired:true,warehouseId:"",batchId:"",serialNumberId:"",purchaseAllocations:[]});
  expect(draft.lines[0]).not.toHaveProperty("unitSelection");expect(draft.lines[1].quotationUnitReviewRequired).toBe(false);
  draft.lines[0].quantity="9";expect(preview.lines[0].quantity).toBe("2");
 });
 it("prepares an unconfirmed order with the same source and financial values",()=>{const draft=quotationOrderPrefill({...preview,targetType:"SALES_ORDER"},"2026-10-20");expect(draft).toMatchObject({sourceQuotationRevisionId:"revision",taxMode:"INCLUSIVE",roundOffAmount:"-0.40",lines:[{quantity:"2",rate:"59",quotationUnitReviewRequired:true},{}]});expect(draft).not.toHaveProperty("status");expect(draft).not.toHaveProperty("journalEntryId");expect(()=>quotationOrderPrefill(preview,"2026-10-20")).toThrow("INVALID_QUOTATION_CONVERSION_TARGET");});
 it("refuses an order preview in the Sale form",()=>expect(()=>quotationSalePrefill({...preview,targetType:"SALES_ORDER"},"2026-10-20")).toThrow("INVALID_QUOTATION_CONVERSION_TARGET"));
});
