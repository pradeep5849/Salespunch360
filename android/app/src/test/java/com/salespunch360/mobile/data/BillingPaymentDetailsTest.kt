package com.salespunch360.mobile.data
import kotlinx.serialization.json.Json
import kotlinx.serialization.decodeFromString
import org.junit.Assert.*
import org.junit.Test
class BillingPaymentDetailsTest{
 @Test fun retainsRecordedPaymentReferenceCaptureTimeAndExactAmount(){val order=Json.decodeFromString<MobileBillingOrder>("""{"id":"order","status":"PAID","billingPeriod":"SIX_MONTH","totalAmount":"900.50","currency":"INR","provider":"MANUAL","createdAt":"2026-11-22T01:00:00Z","telecallerSeats":2,"payments":[{"id":"payment","status":"CAPTURED","provider":"MANUAL","providerPaymentId":"provider-ref","manualReference":"bank-ref","amount":"900.50","currency":"INR","createdAt":"2026-11-22T01:00:00Z","capturedAt":"2026-11-22T02:00:00Z"}]}""");assertEquals("900.50",order.payments.single().amount);assertEquals("bank-ref",order.payments.single().manualReference);assertEquals("2026-11-22T02:00:00Z",order.payments.single().capturedAt);assertEquals(2,order.telecallerSeats)}
}
