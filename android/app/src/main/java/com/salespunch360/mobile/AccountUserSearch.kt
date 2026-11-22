package com.salespunch360.mobile

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/** Search only the authorized directory fields; never passwords, IDs or nested settings. */
internal fun accountUserMatches(user:JsonObject,query:String):Boolean {
 val terms=query.trim().split(Regex("\\s+")).filter{it.isNotBlank()}
 val fields=listOf("name","email","phone","accountRole","salesRole").mapNotNull{(user[it] as? JsonPrimitive)?.contentOrNull?.replace('_',' ')}
 return terms.all{term->fields.any{it.contains(term,ignoreCase=true)}}
}
