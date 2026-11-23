package com.salespunch360.mobile.data
import java.net.URI
/** Only local read/review routes emitted by the verification service are actionable. */
fun verificationReviewPath(raw:String?):String?=runCatching{
 val uri=URI(raw?:return null)
 if(uri.scheme!=null||uri.host!=null||uri.rawQuery!=null||uri.rawFragment!=null)return null
 val roots=listOf("/workspace/account/accounting/journals","/workspace/account/transactions","/workspace/account/projects","/workspace/account/assets","/workspace/account/settlements")
 val static=listOf("/workspace/account/accounting/accounts","/workspace/account/money/accounts","/workspace/account/inventory/stock","/workspace/account/inventory/transfers","/workspace/account/utilities/period-locks")
 val path=uri.rawPath?:return null
 if(path in static||path in roots)return path
 if(roots.any { root -> path.startsWith("$root/")&&path.removePrefix("$root/").matches(Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")) })path else null
}.getOrNull()
