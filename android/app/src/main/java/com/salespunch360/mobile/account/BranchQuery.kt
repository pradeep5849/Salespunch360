package com.salespunch360.mobile.account
import java.net.URLEncoder

/** Explicit drill-down scope takes precedence; otherwise carry the selected Account branch. */
fun accountBranchQuery(path: String, branchId: String?, companyWide: Boolean): String {
    val query = path.substringAfter("?", "")
    if (query.split('&').any { it.substringBefore('=') in listOf("branchId", "scope") }) return query
    val scope = if (companyWide) "scope=all" else branchId?.let { "branchId=${URLEncoder.encode(it, "UTF-8")}" } ?: return query
    return listOf(query, scope).filter { it.isNotBlank() }.joinToString("&")
}
