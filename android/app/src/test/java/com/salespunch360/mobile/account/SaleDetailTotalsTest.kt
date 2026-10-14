package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class SaleDetailTotalsTest {
    @Test fun creditOnlyReductionIsNotCashReceived() {
        val doc=buildJsonObject{put("status","POSTED");put("grandTotal","100.00");putJsonObject("financial"){put("outstanding","40.00")};putJsonArray("adjustments"){add(buildJsonObject{put("type","CREDIT_NOTE");put("status","POSTED");put("grandTotal","60.00")})}}
        val totals=saleDetailTotals(doc)
        assertEquals("0.00",totals.received);assertEquals("60.00",totals.credits);assertEquals("40.00",totals.outstanding)
    }
    @Test fun cancelledInvoiceWithNullFinancialDoesNotCrashOrShowAFullDebt() {
        val doc=buildJsonObject{put("status","CANCELLED");put("grandTotal","1593.00");put("financial",JsonNull)}
        val totals=saleDetailTotals(doc)
        assertEquals("0.00",totals.outstanding);assertEquals("CANCELLED",totals.lifecycle);assertFalse(totals.canChange)
    }
    @Test fun receiptDiscountUsesExactDecimalArithmeticAndExcludesPendingCheques() {
        val doc=buildJsonObject{put("status","POSTED");put("grandTotal","9876543210123.11");putJsonArray("allocations"){
            add(buildJsonObject{put("amount","9876543210123.11");put("discountAmount","0.10");putJsonObject("settlement"){put("type","CUSTOMER_RECEIPT");put("status","POSTED")}})
            add(buildJsonObject{put("amount","100.00");putJsonObject("settlement"){put("type","CUSTOMER_RECEIPT");put("status","PENDING_CHEQUE")}})
        }}
        val totals=saleDetailTotals(doc)
        assertEquals("9876543210123.01",totals.received);assertEquals("0.10",totals.discount)
    }
}
