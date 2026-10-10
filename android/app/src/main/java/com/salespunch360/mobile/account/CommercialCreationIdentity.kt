package com.salespunch360.mobile.account

import java.util.UUID
import kotlinx.serialization.json.*

/** Retain the request identity after a lost response; a new intent gets a new key. */
class CommercialCreationIdentity(private val newKey: () -> String = { UUID.randomUUID().toString() }) {
    private var intent: String? = null
    private var key: String? = null
    fun payload(input: JsonObject): JsonObject {
        val current = input.toString()
        if (intent != current) { intent = current; key = newKey() }
        return buildJsonObject { input.forEach { (field, value) -> put(field, value) }; put("idempotencyKey", key!!) }
    }
    fun reset() { intent = null; key = null }
}
