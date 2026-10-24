package com.salespunch360.mobile.account

import java.math.BigDecimal
import kotlinx.serialization.json.*

fun productStockTotals(rows: List<JsonObject>): Map<String, BigDecimal> {
    val totals = mutableMapOf<String, BigDecimal>()
    rows.forEach { row ->
        val id = row["productId"]?.jsonPrimitive?.contentOrNull
            ?: row["product"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull
            ?: throw IllegalArgumentException("Stock product unavailable")
        val quantity = row["quantity"]?.jsonPrimitive?.contentOrNull?.toBigDecimalOrNull()
            ?: throw IllegalArgumentException("Stock quantity unavailable")
        totals[id] = (totals[id] ?: BigDecimal.ZERO).add(quantity)
    }
    return totals
}

/** Display only: movement quantities retain their authoritative precision. */
fun formatStockQuantity(quantity: BigDecimal, decimals: Int): String {
    val rounded = quantity.setScale(decimals.coerceIn(0, 4), java.math.RoundingMode.HALF_UP)
    val text = rounded.toPlainString()
    return if (quantity.signum() < 0 && rounded.signum() == 0) "-$text" else text
}
