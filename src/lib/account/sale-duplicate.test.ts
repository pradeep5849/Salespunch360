import {Prisma} from "@prisma/client";
import {describe,expect,it} from "vitest";
import {saleDuplicateDraft} from "./sale-duplicate";
const D=(value:string)=>new Prisma.Decimal(value);
const source={id:"original-document",documentNumber:"OLD-123",type:"SALES_INVOICE",status:"POSTED",branchId:"branch",partyId:"party",projectId:null,billingName:"Buyer",shippingAddress:"Delivery site",notes:"Agreed terms",stateOfSupplyCode:"29",taxMode:"EXCLUSIVE",reverseCharge:false,freightAmount:D("10"),otherChargesAmount:D("2"),taxableTotal:D("200"),tdsAmount:D("0"),tcsAmount:D("0"),customValues:{reference:"Job 12"},journalEntryId:"OLD-JOURNAL",allocations:[{id:"OLD-PAYMENT"}],advanceApplications:[{id:"OLD-ADVANCE"}],issueDate:new Date("2026-01-01"),ewayBillNumber:"OLD-EWAY",lines:[{id:"original-line",lineType:"PRODUCT",productId:"product",serviceId:null,workPackageId:null,itemName:"Product",itemCode:"P1",description:"Finish",specification:"White",unitName:"Number",unitSymbol:"Nos",quantity:D("2"),rate:D("100"),discountType:null,discountValue:null,taxRate:D("18"),cessRate:D("0"),warehouseId:"warehouse",batchId:"OLD-BATCH",serialNumberId:"OLD-SERIAL",sourceCommercialLineId:"OLD-RETURN",purchaseAllocations:[{id:"OLD-ALLOCATION"}],servicePeriodDays:null,internalCost:"SECRET-COST"}]};
describe("new sale draft from an authorized source snapshot",()=>{
 it.each(["DRAFT","POSTED"])("copies editable values from %s without identity or financial links",status=>{const result=saleDuplicateDraft({...source,status} as never,"2026-10-14");expect(result).toMatchObject({branchId:"branch",partyId:"party",issueDate:"2026-10-14",billingName:"Buyer",shippingAddress:"Delivery site",notes:"Agreed terms",customValues:{reference:"Job 12"},roundOffAmount:"0",lines:[{sourceId:"product",quantity:"2",rate:"100",warehouseId:"warehouse",batchId:"",serialNumberId:"",sourceCommercialLineId:"",purchaseAllocations:[]}]});expect(result).not.toHaveProperty("id");expect(result).not.toHaveProperty("documentNumber");expect(JSON.stringify(result)).not.toMatch(/OLD-|original-|SECRET-COST/);});
 it("does not mutate the original snapshot when the draft is edited",()=>{const result=saleDuplicateDraft(source as never,"2026-10-14");result.lines[0].quantity="9";result.customValues!.reference="Changed";expect(source.customValues.reference).toBe("Job 12");expect(source.lines[0].quantity.toString()).toBe("2");});
 it("retains only server-recheckable IDs for a copied secondary-unit line",()=>{
  const result=saleDuplicateDraft({...source,lines:[{...source.lines[0],unitConversionSnapshot:{selection:"SECONDARY",secondaryUnitsPerBase:"0.1"}}]} as never,"2026-10-20");
  expect(result.copiedFromSaleId).toBe(source.id);
  expect(result.lines[0].copiedFromSaleLineId).toBe(source.lines[0].id);
  expect(result.lines[0]).not.toHaveProperty("unitConversionSnapshot");
  expect(result.lines[0]).not.toHaveProperty("baseQuantity");
  expect(result.lines[0].sourceCommercialLineId).toBe("");
 });
 it("rejects non-sale sources",()=>expect(()=>saleDuplicateDraft({...source,type:"PURCHASE_BILL"} as never,"2026-10-14")).toThrow("SALE_DUPLICATE_UNAVAILABLE"));
});
