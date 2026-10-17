package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class PurchaseMasterPricingTest {
 private fun master()=SalesOption("service","Service",rate="50",taxRate="18",pricing=buildJsonObject{put("enteredSalePrice","118");put("enteredPurchasePrice","59");put("saleTaxMode","INCLUSIVE");put("purchaseTaxMode","INCLUSIVE");put("discountType","FIXED");put("discountValue","11.8");put("normalizedDiscountValue","10")})
 @Test fun newPurchasesUseCompanyTaxModeAndLegacyProfilesRemainExclusive(){assertEquals("INCLUSIVE",purchaseInitialTaxMode(buildJsonObject{put("defaultTaxMode","INCLUSIVE")}));assertEquals("EXCLUSIVE",purchaseInitialTaxMode(buildJsonObject{}))}
 @Test fun explicitItemSelectionUsesPurchaseCostInDocumentModeWithoutApplyingSaleDiscount(){val line=SalesLineDraft(lineType="SERVICE",quantity="3");val inclusive=purchaseMasterLine(line,master(),"INCLUSIVE");assertEquals("59.00",inclusive.rate);assertEquals("50.00",purchaseMasterLine(line,master(),"EXCLUSIVE").rate);assertEquals("",inclusive.discountType);assertEquals("0",inclusive.discountValue);assertEquals("3",inclusive.quantity);val payload=purchasePayload(PurchaseDraft(taxMode="INCLUSIVE",lines=listOf(inclusive)));assertEquals("INCLUSIVE",payload.str("taxMode"));assertEquals("59.00",payload.array("lines").single().str("rate"))}
 @Test fun manualLineDiscountIsRetainedAndOldItemTrackingLineageIsClearedOnNewSelection(){val old=SalesLineDraft(lineType="SERVICE",discountType="FIXED",discountValue="7",sourceCommercialLineId="old",batchId="batch",serialNumberId="serial");val next=purchaseMasterLine(old,master(),"INCLUSIVE");assertEquals("FIXED",next.discountType);assertEquals("7",next.discountValue);assertEquals("",next.sourceCommercialLineId);assertEquals("",next.batchId);assertEquals("",next.serialNumberId);assertEquals("old",old.sourceCommercialLineId)}
 @Test fun savedInclusivePurchaseCostKeepsItsOriginalCent(){val item=master().copy(rate="101.69",pricing=buildJsonObject{put("enteredSalePrice","0");put("enteredPurchasePrice","120.00");put("purchaseTaxMode","INCLUSIVE")});assertEquals("120.00",purchaseMasterLine(SalesLineDraft(),item,"INCLUSIVE").rate)}
 @Test fun legacyAndHistoricalSourceRatesAreNotGuessedFromCurrentMasterPricing(){assertEquals("59",purchaseMasterLine(SalesLineDraft(),SalesOption("old","Old",rate="59"),"INCLUSIVE").rate);val source=purchaseSourceLine(buildJsonObject{put("id","original");put("lineType","SERVICE");put("serviceId","service");put("rate","42");put("taxRate","18");put("quantity","1")});assertEquals("42",source.rate);assertEquals("original",source.sourceCommercialLineId)}
}
