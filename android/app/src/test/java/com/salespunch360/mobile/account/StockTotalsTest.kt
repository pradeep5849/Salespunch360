package com.salespunch360.mobile.account

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class StockTotalsTest {
    private fun row(product: String, quantity: String) = buildJsonObject {
        put("productId", product); put("quantity", quantity)
    }
    @Test fun addsEveryWarehouseUsingExactDecimalQuantities() {
        val totals = productStockTotals(listOf(row("one","0.1"),row("one","0.2"),row("other","7"),row("one","-0.05")))
        assertEquals("0.25", totals["one"]?.toPlainString())
        assertEquals("7", totals["other"]?.toPlainString())
    }
    @Test fun supportsTheNestedProductResponse() {
        val totals = productStockTotals(listOf(buildJsonObject { putJsonObject("product") {put("id","one")}; put("quantity","3.5") }))
        assertEquals("3.5",totals["one"]?.toPlainString())
    }
    @Test fun missingQuantityNeverBecomesZeroStock() {
        try {productStockTotals(listOf(buildJsonObject {put("productId","one")}));fail("Invalid stock must be rejected")}
        catch(error:IllegalArgumentException){assertEquals("Stock quantity unavailable",error.message)}
    }
}
