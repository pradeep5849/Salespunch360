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

data class AccountReportEntry(val key:String,val name:String,val group:String)
fun accountReportCatalogue(options:JsonObject,search:String=""):List<AccountReportEntry>{
 val entries=options.array("catalogue").map{AccountReportEntry(it.str("key"),it.str("name"),it.str("group"))}.ifEmpty{accountReportNames(options).map{AccountReportEntry(it,it.replace('-',' '),"Reports")}}
 val query=search.trim().lowercase()
 return entries.filter{"${it.key} ${it.name} ${it.group}".lowercase().contains(query)}
}
fun accountReportFavourites(options:JsonObject)= (options["favourites"] as? JsonArray)?.mapNotNull{(it as? JsonPrimitive)?.contentOrNull}.orEmpty().toSet()

fun accountReportLinks(data:JsonObject)=(data["rowLinks"] as? JsonArray)?.map{(it as? JsonPrimitive)?.contentOrNull.orEmpty()}.orEmpty()

fun accountReportSpecificFilters(options:JsonObject,key:String):Set<String>? {
 val metadata=options.array("catalogue").firstOrNull{it.str("key")==key}?:return null
 val filters=metadata["filters"] as? JsonArray?:return null
 return filters.mapNotNull{(it as? JsonPrimitive)?.contentOrNull}.toSet()
}
