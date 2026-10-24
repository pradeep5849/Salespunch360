package com.salespunch360.mobile.account

import org.junit.Assert.*
import org.junit.Test

class DocumentSharingTest{
 @Test fun removesPathSeparatorsAndLimitsNames(){assertEquals("INV_12_34",documentShareName("INV/12\\34"));assertEquals(120,documentShareName("x".repeat(200)).length)}
 @Test fun retainsAuthoritativePaymentStatuses(){assertEquals("SALE : PAID",homePaymentLabel("SALES_INVOICE","POSTED","PAID"));assertEquals("SALE : PARTIAL",homePaymentLabel("SALES_INVOICE","POSTED","PARTIALLY_PAID"));assertEquals("SALE : UNPAID",homePaymentLabel("SALES_INVOICE","POSTED",null));assertEquals("CANCELLED",homePaymentLabel("SALES_INVOICE","CANCELLED","PAID"));assertEquals("SALES ORDER",homePaymentLabel("SALES_ORDER","DRAFT",null))}
 @Test fun usesFallbackForBlankName(){assertEquals("Document",documentShareName("  "))}
}
