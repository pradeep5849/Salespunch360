package com.salespunch360.mobile.data

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class BillingPurchaseIntentTest {
 private fun quote(mode:String?)=BillingQuote(kind="PLUS",billingPeriod="SIX_MONTH",adminSeats=1,managerSeats=2,salesSeats=3,telecallerSeats=4,accountPackages=2,totalAmount="1400.00",currency="INR",purchaseMode=mode)
 @Test fun renewalSurvivesCheckoutSerialization(){val request=manualOrderFromQuote(quote("RENEW"),"reviewed-key");val json=Json.parseToJsonElement(Json.encodeToString(request)).jsonObject;assertEquals("RENEW",json["purchaseMode"]?.jsonPrimitive?.content);assertEquals(3,request.salesSeats);assertEquals(4,request.telecallerSeats);assertEquals(2,request.accountPackages)}
 @Test fun additionsRemainAdditions(){for(mode in listOf("ADD_TEAM","ADD_ACCOUNT"))assertEquals(mode,manualOrderFromQuote(quote(mode),"key").purchaseMode)}
 @Test fun olderQuoteWithoutModeRemainsCompatible(){assertNull(manualOrderFromQuote(quote(null),"key").purchaseMode)}
}
