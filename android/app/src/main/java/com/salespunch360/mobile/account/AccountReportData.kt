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

data class AccountReportEntry(val key:String,val name:String,val group:String,val aliases:List<String> = emptyList())
fun accountReportCatalogue(options:JsonObject,search:String=""):List<AccountReportEntry>{
 val entries=options.array("catalogue").map{AccountReportEntry(it.str("key"),it.str("name"),it.str("group"),(it["aliases"] as? JsonArray)?.mapNotNull{value->(value as? JsonPrimitive)?.contentOrNull}.orEmpty())}.ifEmpty{accountReportNames(options).map{AccountReportEntry(it,it.replace('-',' '),"Reports")}}
 val query=search.trim().lowercase()
 return entries.filter{"${it.key} ${it.name} ${it.group} ${it.aliases.joinToString(" ")}".lowercase().contains(query)}
}
fun accountReportFavourites(options:JsonObject)= (options["favourites"] as? JsonArray)?.mapNotNull{(it as? JsonPrimitive)?.contentOrNull}.orEmpty().toSet()

fun accountReportLinks(data:JsonObject)=((data["nativeRowLinks"]?:data["rowLinks"]) as? JsonArray)?.map{(it as? JsonPrimitive)?.contentOrNull.orEmpty()}.orEmpty()

fun accountReportSpecificFilters(options:JsonObject,key:String):Set<String>? {
 val metadata=options.array("catalogue").firstOrNull{it.str("key")==key}?:return null
 val filters=metadata["filters"] as? JsonArray?:return null
 return filters.mapNotNull{(it as? JsonPrimitive)?.contentOrNull}.toSet()
}

fun accountReportDestination(value:String):String?=value.takeIf{Regex("^/workspace/account/(?:money/capital|sales|purchases|expenses|transactions)/[a-fA-F0-9-]{36}(?:\\?.*)?$").matches(it)}

/** Preserve an explicit money-type scope on the initial request before metadata arrives. */
fun accountReportRequestFilters(options:JsonObject,report:String,candidates:Map<String,String>):Map<String,String> {
 val supported=accountReportSpecificFilters(options,report)
 val lifetime=report=="projects"||report=="budget-vs-actual"
 val known=setOf("classificationSide","orderType","orderStatus","from","to","branchId","projectId","ledgerId","customerId","vendorId","ownerId","productId","accountType","categoryId","itemStatus","moneyAccountId","loanId","stockLevel","itemSearch")
 val day=candidates["to"].orEmpty().ifBlank{candidates["from"].orEmpty()}
 val source=if(report=="day-book"&&day.isNotBlank())candidates+mapOf("from" to day,"to" to day) else candidates
 return source.filter{(key,value)->
  value.isNotBlank()&&key in known&&
  (report!="day-book"||key in setOf("from","to","branchId"))&&
  (!lifetime||key=="branchId"||key=="projectId")&&
  (key !in setOf("orderType","orderStatus")||report in setOf("order-transactions","order-items"))&&
  (key!="classificationSide"||report=="sac-sales")&&
  (key!="stockLevel"||report=="stock-summary")&&
  (key!="loanId"||report=="loan-statement")&&
  (key!="moneyAccountId"||report=="bank-statement")&&
  (key!="categoryId"||report in setOf("stock-detail","stock-summary","low-stock-summary","item-discount"))&&
  (key!="itemStatus"||report in setOf("stock-detail","stock-summary","low-stock-summary"))&&
  (key!="itemSearch"||report in setOf("stock-detail","stock-summary","low-stock-summary","item-serial","item-batch","item-discount","party-items","item-party"))&&
  (key!="accountType"||report=="cash-bank")&&
  (key!="ownerId"||report=="owner-capital"||report=="profit-withdrawal")&&
  (key in setOf("from","to","branchId")||(key=="accountType"&&report=="cash-bank")||supported?.contains(key)!=false)
 }
}

data class UnavailableAccountReportEntry(val name:String,val group:String,val reason:String)
fun accountUnavailableReportCatalogue(options:JsonObject,search:String=""):List<UnavailableAccountReportEntry>{
 val query=search.trim().lowercase()
 return options.array("unavailableCatalogue").map{UnavailableAccountReportEntry(it.str("name"),it.str("group"),it.str("reason"))}.filter{"${it.name} ${it.group}".lowercase().contains(query)}
}
