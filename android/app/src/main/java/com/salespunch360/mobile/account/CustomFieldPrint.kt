package com.salespunch360.mobile.account

fun supportsCustomFieldPrint(entity: String): Boolean = entity in setOf(
    "CUSTOMER", "VENDOR", "QUOTATION", "SALES_INVOICE", "PURCHASE_BILL"
)
