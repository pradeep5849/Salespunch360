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

/** UI preferences are separate from the validated financial scope request. */
fun moneyContextQuery(query: String): String = query.split('&').filter {
    it.substringBefore('=') in listOf("branchId", "scope")
}.joinToString("&")
fun moneyAccountInitialType(mode: String, query: String): String {
    if (mode == "cash-in-hand") return "CASH"
    val requested = query.split('&').firstOrNull { it.substringBefore('=') == "type" }?.substringAfter('=')
    return if (mode == "accounts" && requested in listOf("CASH", "PETTY_CASH")) requested!! else "BANK"
}
