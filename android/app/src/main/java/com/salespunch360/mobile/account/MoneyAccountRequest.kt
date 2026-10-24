package com.salespunch360.mobile.account

import java.util.UUID
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Keep one identity across ambiguous retries while retaining the user's draft. */
fun moneyAccountCreationPayload(payload: JsonObject, requestKey: String): JsonObject {
    UUID.fromString(requestKey)
    return JsonObject(payload + ("creationRequestKey" to JsonPrimitive(requestKey)))
}
