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

/** Paged results belong to the confirmed query; older servers retain local-search compatibility. */
internal fun accountDirectoryUsers(root:JsonObject,query:String):List<kotlinx.serialization.json.JsonElement>{
 val rows=(root["users"] as? kotlinx.serialization.json.JsonArray).orEmpty()
 val page=root["directory"] as? JsonObject
 if(page==null)return rows.filter{(it as? JsonObject)?.let{user->accountUserMatches(user,query)}==true}
 return if((page["q"] as? JsonPrimitive)?.contentOrNull==query.trim())rows else emptyList()
}
