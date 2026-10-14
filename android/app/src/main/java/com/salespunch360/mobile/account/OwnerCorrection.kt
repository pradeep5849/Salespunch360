package com.salespunch360.mobile.account

import java.time.LocalDate
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

fun validOwnerCorrectionDate(value: String): Boolean = runCatching {
    LocalDate.parse(value).toString() == value
}.getOrDefault(false)

fun ownerCorrectionPayload(transactionId: String, date: String, reason: String, branchId: String = ""): JsonObject {
    require(transactionId.isNotBlank() && validOwnerCorrectionDate(date))
    require(reason.trim().length in 3..1000)
    return buildJsonObject {
        if(branchId.isNotBlank())put("branchId",branchId)
        put("transactionId", transactionId)
        put("entryDate", date)
        put("reason", reason.trim())
    }
}
