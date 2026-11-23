package com.salespunch360.mobile.data
import java.net.URLEncoder

/** Shared by report paging and Excel so both describe the same lead subset. */
data class LeadReportFilters(val stage:String="ALL",val source:String="ALL",val followUp:String="ALL",val q:String=""){
 fun parameters(type:String):List<String>{
  if(type!="leads")return emptyList()
  return listOf("stage" to stage,"source" to source,"followUp" to followUp,"q" to q.trim()).filter{(_,value)->value.isNotEmpty()&&value!="ALL"}.map{(key,value)->"$key=${URLEncoder.encode(value,"UTF-8")}"}
 }
}
