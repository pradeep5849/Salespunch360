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
}
