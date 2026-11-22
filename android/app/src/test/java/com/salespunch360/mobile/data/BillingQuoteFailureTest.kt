package com.salespunch360.mobile.data
import org.junit.Assert.*
import org.junit.Test
class BillingQuoteFailureTest{
 @Test fun explainsRecoveryWithoutDiscardingTheSelection(){assertTrue(billingQuoteFailureMessage("PRICING_UNAVAILABLE").contains("retry"));assertTrue(billingQuoteFailureMessage("SEATS_BELOW_USAGE").contains("active users"));assertTrue(billingQuoteFailureMessage(null).contains("selection has been kept"))}
}
