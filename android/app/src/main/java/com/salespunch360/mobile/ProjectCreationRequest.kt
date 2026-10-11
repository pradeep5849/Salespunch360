package com.salespunch360.mobile
import kotlinx.serialization.json.*
internal fun projectCreationPayload(payload: JsonObject, key: String) = buildJsonObject {
    payload.forEach { (field, value) -> put(field, value) }
    put("idempotencyKey", key)
}

internal fun projectEditorCustomValues(editingId:String?, options:JsonObject):Map<String,String> =
    if(editingId.isNullOrBlank())emptyMap()else options["customValues"]?.jsonObject?.mapNotNull{(key,value)->(value as? JsonPrimitive)?.contentOrNull?.let{key to it}}?.toMap().orEmpty()
