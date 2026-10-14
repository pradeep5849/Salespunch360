package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test
import kotlinx.serialization.json.*
class AssetFundingReturnsTest {
 private val options=listOf(buildJsonObject { put("id","funding");put("ownerFinancialAccountId","owner");put("branchId","branch");put("remainingAmount","30000.00") })
 @Test fun explicitAttributionPreservesExactCents(){assertEquals("0.01",assetFundingReturns(options,mapOf("funding" to "0.01"),"owner","branch","0.01")!![0].jsonObject["amount"]!!.jsonPrimitive.content)}
 @Test fun rejectsForeignScopeAndExcess(){assertNull(assetFundingReturns(options,mapOf("funding" to "1"),"other","branch","5"));assertNull(assetFundingReturns(options,mapOf("funding" to "1"),"owner","other","5"));assertNull(assetFundingReturns(options,mapOf("funding" to "30001"),"owner","branch","40000"));assertNull(assetFundingReturns(options,mapOf("funding" to "6"),"owner","branch","5"))}
 @Test fun rejectsNegativeAndFractionalCentAllocations(){assertNull(assetFundingReturns(options,mapOf("funding" to "-1"),"owner","branch","5"));assertNull(assetFundingReturns(options,mapOf("funding" to "0.001"),"owner","branch","5"))}
 @Test fun noSelectionRemainsUnallocated(){assertEquals(0,assetFundingReturns(options,emptyMap(),"owner","branch","5")!!.size)}
}
