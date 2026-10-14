package com.salespunch360.mobile.account

import kotlinx.serialization.json.*

internal fun accountReportNames(options: JsonObject) = (options["reports"] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.orEmpty()
internal fun accountReportColumns(data: JsonObject) = (data["columns"] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.orEmpty()
internal fun accountReportRows(data: JsonObject) = (data["rows"] as? JsonArray)?.mapNotNull { row ->
    (row as? JsonArray)?.map { (it as? JsonPrimitive)?.contentOrNull.orEmpty() }
}.orEmpty()

/** Keep exports tied to the request that produced the visible result. */
internal class AppliedAccountReport(val report: String, filters: Map<String, String>) {
    val filters = filters.toMap()
}
