package com.salespunch360.mobile.data
import java.net.URLEncoder

data class GeofenceReportFilters(val action:String="ALL",val eventType:String="ALL",val q:String=""){
 fun parameters(report:String):List<String>{
  if(report!="geofence")return emptyList()
  // The API already uses `type` for report selection, so breach type has a distinct key.
  return listOf("action" to action,"geofenceType" to eventType,"q" to q.trim()).filter{(_,value)->value.isNotEmpty()&&value!="ALL"}.map{(key,value)->"$key=${URLEncoder.encode(value,"UTF-8")}"}
 }
}
