package com.salespunch360.mobile
import kotlinx.serialization.json.*
internal fun projectCreationPayload(payload: JsonObject, key: String) = buildJsonObject {
    payload.forEach { (field, value) -> put(field, value) }
    put("idempotencyKey", key)
}
