package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test
import kotlinx.serialization.json.*
class AddItemValidationTest {
 private fun validate(name:String="Item",sale:String="118",cost:String="59",tax:String="18",opening:String="",date:String="2026-10-16",pricing:JsonObject?=null)=addItemValidationError(name,"","",sale,cost,tax,"","",opening,"0.1250",date,"",pricing)
 @Test fun emptyOptionalAmountsRemainValid(){assertNull(validate(sale="",cost="",tax=""))}
 @Test fun pricesRejectNegativeMalformedAndOutOfRangeValues(){for(x in listOf("-1","NaN","Infinity","no","10000000000000000"))assertNotNull(x,validate(sale=x));assertNotNull(validate(cost="-0.01"));assertNull(validate(sale="9999999999999999"))}
 @Test fun nameAndTaxBoundariesMatchApi(){assertNotNull(validate(name=" "));assertNull(validate(name="x".repeat(200),tax="100"));assertNotNull(validate(name="x".repeat(201)));assertNotNull(validate(tax="100.01"))}
 @Test fun openingDateAndPrecisionAreValidatedWithoutRounding(){assertNull(validate(opening="1.1234"));assertNotNull(validate(opening="1.12345"));assertNotNull(validate(opening="1",date="2026-02-30"))}
 @Test fun discountsRespectSavedTypeAndSalePrice(){assertNotNull(validate(pricing=buildJsonObject{put("discountType","PERCENTAGE");put("discountValue","100.01")}));assertNotNull(validate(pricing=buildJsonObject{put("discountType","FIXED");put("discountValue","118.01")}));assertNull(validate(pricing=buildJsonObject{put("discountType","FIXED");put("discountValue","118")}))}
 @Test fun wholesalePrecisionIsNotSilentlyTruncated(){assertNotNull(validate(pricing=buildJsonObject{put("wholesalePrice","1.12345")}));assertNull(validate(pricing=buildJsonObject{put("wholesalePrice","94.4000")}))}
 @Test fun mrpUsesExactNonnegativeAmountBounds(){assertNull(validate(pricing=buildJsonObject{put("mrp","118.0000")}));for(value in listOf("-1","1.12345","NaN","100000000000000"))assertNotNull(validate(pricing=buildJsonObject{put("mrp",value)}))}
}
