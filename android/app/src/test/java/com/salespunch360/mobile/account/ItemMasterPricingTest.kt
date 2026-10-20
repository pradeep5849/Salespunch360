package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test
import kotlinx.serialization.json.*
class ItemMasterPricingTest {
 private fun master(type:String="PERCENTAGE")=SalesOption("item","Item",rate="100",taxRate="18",pricing=buildJsonObject{put("enteredSalePrice","118.00");put("discountType",type);put("normalizedDiscountValue","10")})
 @Test fun normalizedPricesAreConvertedToTheDocumentMode(){assertEquals("118.00",itemMasterPrice(master(),"INCLUSIVE").rate);assertEquals("100.00",itemMasterPrice(master(),"EXCLUSIVE").rate)}
 @Test fun percentageDefaultsDoNotApplyToPurchases(){assertEquals("PERCENTAGE",itemMasterPrice(master(),"INCLUSIVE").discountType);assertEquals("10",itemMasterPrice(master(),"INCLUSIVE").discountValue);assertEquals("",itemMasterPrice(master(),"INCLUSIVE",true).discountType)}
 @Test fun legacyRatesAndPerUnitFixedDiscountsRemainCorrect(){assertEquals("118",itemMasterPrice(SalesOption("old","Old",rate="118"),"INCLUSIVE").rate);assertEquals("FIXED",itemMasterPrice(master("FIXED"),"EXCLUSIVE").discountType);assertEquals("30",itemMasterPrice(master("FIXED"),"EXCLUSIVE",quantity="3").discountValue);assertEquals("35.4",itemMasterPrice(master("FIXED"),"INCLUSIVE",quantity="3").discountValue)}
 @Test fun percentagesKeepTheirPrecision(){val item=master().copy(pricing=buildJsonObject{put("enteredSalePrice","118");put("discountType","PERCENTAGE");put("normalizedDiscountValue","33.335")});assertEquals("33.335",itemMasterPrice(item,"EXCLUSIVE").discountValue)}
 @Test fun originalInclusivePriceDoesNotLoseACentOnRoundTrip(){val item=master().copy(rate="101.69",pricing=buildJsonObject{put("enteredSalePrice","120.00");put("saleTaxMode","INCLUSIVE")});assertEquals("120.00",itemMasterPrice(item,"INCLUSIVE").rate)}
 @Test fun wholesaleUsesSelectedPriceAndTheSameSavedDiscount(){val item=master("FIXED").copy(pricing=buildJsonObject{put("enteredSalePrice","118");put("saleTaxMode","INCLUSIVE");put("normalizedWholesalePrice","80");put("wholesalePrice","94.40");put("discountType","FIXED");put("discountValue","11.80");put("normalizedDiscountValue","10")});assertEquals("80.00",itemMasterPrice(item,"EXCLUSIVE",quantity="3",priceKind="WHOLESALE").rate);assertEquals("30",itemMasterPrice(item,"EXCLUSIVE",quantity="3",priceKind="WHOLESALE").discountValue);assertEquals("94.40",itemMasterPrice(item,"INCLUSIVE",priceKind="WHOLESALE").rate)}
 @Test fun customerPriceIsExplicitAndUsesTheSelectedRateNotRetailGross(){
 val item=master("FIXED").copy(pricing=buildJsonObject{put("enteredSalePrice","118");put("saleTaxMode","INCLUSIVE");put("discountType","FIXED");put("discountValue","11.80");put("normalizedDiscountValue","10")})
 assertEquals("118.00",itemMasterPrice(item,"INCLUSIVE").rate)
 val price=itemMasterPrice(item,"INCLUSIVE",quantity="3",priceKind="CUSTOMER",customerRate="80")
 assertEquals("94.40",price.rate);assertEquals("35.4",price.discountValue)
 assertEquals("94.40",itemMasterPrice(SalesOption("old","Old",rate="100",taxRate="18"),"INCLUSIVE",priceKind="CUSTOMER",customerRate="80").rate)
 }
 @Test fun customerRateMatchesCustomerProductAndInclusiveDates(){
 val options=SalesOptions(customerPrices=listOf(buildJsonObject{put("productId","item");put("customerId","party");put("rate","80");put("effectiveFrom","2026-10-01");put("effectiveTo","2026-10-31")}))
 assertEquals("80",options.customerPrice("item","party","2026-10-01"));assertEquals("80",options.customerPrice("item","party","2026-10-31"))
 assertNull(options.customerPrice("item","other","2026-10-01"));assertNull(options.customerPrice("item","party","2026-11-01"))
 }

 @Test fun wholesaleCatalogueWinsWithoutReusingMasterGrossAndFallsBack(){
 val item=master("FIXED").copy(pricing=buildJsonObject{put("enteredSalePrice","118");put("saleTaxMode","INCLUSIVE");put("normalizedWholesalePrice","90");put("wholesalePrice","106.20");put("discountType","FIXED");put("discountValue","11.80")})
 val selected=itemMasterPrice(item,"INCLUSIVE",quantity="3",priceKind="WHOLESALE",wholesaleRate="70")
 assertEquals("82.60",selected.rate);assertEquals("35.4",selected.discountValue)
 assertEquals("106.20",itemMasterPrice(item,"INCLUSIVE",priceKind="WHOLESALE").rate)
 assertEquals("82.60",itemMasterPrice(SalesOption("old","Old",rate="100",taxRate="18"),"INCLUSIVE",priceKind="WHOLESALE",wholesaleRate="70").rate)
 }
 @Test fun wholesaleDatesAreInclusiveAndSettingDisablesCatalogue(){
 val rows=listOf(buildJsonObject{put("productId","item");put("rate","70");put("effectiveFrom","2026-10-01");put("effectiveTo","2026-10-31")})
 val options=SalesOptions(wholesalePrices=rows)
 assertEquals("70",options.wholesaleRate("item","2026-10-01"));assertEquals("70",options.wholesaleRate("item","2026-10-31"))
 assertNull(options.wholesaleRate("item","2026-11-01"));assertNull(options.wholesaleRate("other","2026-10-01"));assertNull(options.copy(wholesalePrice=false).wholesaleRate("item","2026-10-01"))
 }

 @Test fun secondaryPriceAndDiscountUsePrimaryQuantities(){
  val item=SalesOption("item","Item",rate="20",secondaryUnitsPerBase="0.1",pricing=buildJsonObject{put("enteredSalePrice","20");put("discountType","FIXED");put("normalizedDiscountValue","1")})
  val price=itemMasterPriceForUnit(item,"EXCLUSIVE",quantity="2",selection="SECONDARY")
  assertEquals("200.00",price.rate);assertEquals("20",price.discountValue)
  assertEquals("100.00",itemMasterPriceForUnit(item,"EXCLUSIVE",quantity="1",selection="SECONDARY",priceKind="CUSTOMER",customerRate="10").rate)
 }
 @Test fun secondaryQuantityMustConvertExactly(){
  assertEquals("10.0000",primaryUnitQuantity("1","SECONDARY","0.1").toPlainString())
  assertThrows(IllegalArgumentException::class.java){primaryUnitQuantity("1","SECONDARY","0.3")}
  assertThrows(IllegalArgumentException::class.java){primaryUnitQuantity("1","SECONDARY","")}
 }

 @Test fun optionDecoderKeepsAssignedUnitRules(){
  val option=Json.parseToJsonElement("""{"id":"item","name":"Item","salePrice":"20","unitId":"piece","secondaryUnitId":"box","secondaryUnitsPerBase":"0.1"}""").jsonObject.option()
  assertEquals("piece",option.unitId);assertEquals("box",option.secondaryUnitId);assertEquals("0.1",option.secondaryUnitsPerBase)
 }

 @Test fun genericSalesUnitSelectionUsesAssignedPriceAndProtectsHistory(){
  val item=master("FIXED").copy(unitId="piece",secondaryUnitId="box",secondaryUnitsPerBase="0.1")
  val selected=salesUnitLine(SalesLineDraft(quantity="2"),item,"EXCLUSIVE","SECONDARY",unit=SalesOption("box","Box",symbol="Bx"))
  assertEquals("1000.00",selected.rate);assertEquals("200",selected.discountValue);assertEquals("Box",selected.unitName)
  assertEquals("SECONDARY",selected.unitSelection)
  assertThrows(IllegalArgumentException::class.java){salesUnitLine(selected.copy(sourceCommercialLineId="original"),item,"EXCLUSIVE","PRIMARY")}
  assertThrows(IllegalArgumentException::class.java){salesUnitLine(SalesLineDraft(),item.copy(secondaryUnitId=""),"EXCLUSIVE","SECONDARY")}
  assertThrows(IllegalArgumentException::class.java){salesUnitLine(SalesLineDraft(quantity="0.00001"),item,"EXCLUSIVE","SECONDARY")}
 }
}
