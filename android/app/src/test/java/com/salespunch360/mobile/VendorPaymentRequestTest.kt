package com.salespunch360.mobile
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
class VendorPaymentRequestTest {
 private fun state()=VendorPaymentState(loading=false,allowedTypes=listOf("VENDOR_PAYMENT","VENDOR_ADVANCE"),branchId="branch",vendorId="vendor",amount="150",date="2026-11-05",requestKey="stable",multipleLinks=true,links=mapOf("bill" to "100"),bills=listOf(PayableBill("bill","branch","vendor","B","100")))
 @Test fun partialLinksKeepOneCashAmountAndStableRetryKey(){val s=state();assertNull(vendorPaymentValidation(s));val payload=vendorPaymentPayload(s);assertEquals("150",payload["amount"]!!.jsonPrimitive.content);assertEquals("100",payload["allocations"]!!.jsonArray[0].jsonObject["amount"]!!.jsonPrimitive.content);assertEquals(payload,vendorPaymentPayload(s))}
 @Test fun foreignBillsAndOverAllocationAreRejected(){assertNotNull(vendorPaymentValidation(state().copy(vendorId="other")));assertNotNull(vendorPaymentValidation(state().copy(amount="90")));assertNotNull(vendorPaymentValidation(state().copy(amount="1e3")))}
 @Test fun unusedAdvanceHasNoFakeBillLink(){val s=state().copy(type="VENDOR_ADVANCE");assertNull(vendorPaymentValidation(s));assertEquals(0,vendorPaymentPayload(s)["allocations"]!!.jsonArray.size)}
}
