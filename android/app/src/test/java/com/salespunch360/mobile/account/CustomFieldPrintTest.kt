package com.salespunch360.mobile.account

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CustomFieldPrintTest {
    @Test fun supportedEntityOutputsAllowPrintVisibility() {
        listOf("CUSTOMER", "VENDOR", "QUOTATION", "SALES_INVOICE", "PURCHASE_BILL").forEach {
            assertTrue(supportsCustomFieldPrint(it))
        }
    }
    @Test fun entitiesWithoutPrintOutputsDoNotAdvertiseVisibility() {
        listOf("PRODUCT", "SERVICE", "WORK_PACKAGE", "PROJECT", "ASSET").forEach {
            assertFalse(supportsCustomFieldPrint(it))
        }
    }
}
