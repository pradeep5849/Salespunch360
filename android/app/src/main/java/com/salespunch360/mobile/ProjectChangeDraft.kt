package com.salespunch360.mobile

import java.util.UUID
import kotlinx.serialization.json.*

data class ProjectChangeDraft(val id: String? = null, val title: String = "", val description: String = "", val valueDelta: String = "0", val estimatedCostDelta: String = "0", val requestKey: String = UUID.randomUUID().toString())
internal fun validProjectChange(row: ProjectChangeDraft) = row.title.trim().length in 1..240 && row.description.length <= 5000 && listOf(row.valueDelta, row.estimatedCostDelta).all { Regex("^-?[0-9]{1,16}(\\.[0-9]{1,2})?$").matches(it) }
internal fun projectChangePayload(row: ProjectChangeDraft) = buildJsonObject {
    put("operation", if (row.id == null) "CREATE" else "EDIT")
    putJsonObject("payload") {
        if (row.id != null) put("changeOrderId", row.id) else put("idempotencyKey", row.requestKey)
        put("title", row.title.trim()); put("description", row.description.trim())
        put("valueDelta", row.valueDelta); put("estimatedCostDelta", row.estimatedCostDelta)
    }
}
