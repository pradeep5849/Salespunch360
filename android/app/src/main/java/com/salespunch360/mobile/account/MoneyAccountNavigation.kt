package com.salespunch360.mobile.account

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject

fun moneyAccountListMode(path: String): String? = when(path.substringBefore("?")) {
    "/workspace/account/money/accounts" -> "accounts"
    "/workspace/account/money/bank-accounts" -> "bank-accounts"
    "/workspace/account/money/cash-in-hand" -> "cash-in-hand"
    else -> null
}
fun moneyAccountRowsForMode(rows: List<JsonElement>, mode: String): List<JsonElement> = when(mode) {
    "bank-accounts" -> rows.filter { it.jsonObject.str("type") == "BANK" }
    "cash-in-hand" -> rows.filter { it.jsonObject.str("type") == "CASH" }
    "accounts" -> rows
    else -> emptyList()
}
