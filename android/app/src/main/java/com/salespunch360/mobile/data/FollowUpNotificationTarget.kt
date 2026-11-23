package com.salespunch360.mobile.data
import java.net.URI
import java.net.URLDecoder
import java.util.UUID

data class FollowUpNotificationTarget(val status:String="PENDING",val leadId:String?=null)
fun followUpNotificationTarget(target:String?):FollowUpNotificationTarget=runCatching{
 val uri=URI(target?:return FollowUpNotificationTarget())
 if(uri.scheme!=null||uri.host!=null||uri.path!="/workspace/follow-up-tasks")return FollowUpNotificationTarget()
 val query=uri.rawQuery.orEmpty().split('&').filter{it.contains('=')}.associate{part->URLDecoder.decode(part.substringBefore('='),"UTF-8") to URLDecoder.decode(part.substringAfter('='),"UTF-8")}
 val status=query["status"]?.takeIf{it in listOf("PENDING","TODAY","OVERDUE","UPCOMING","COMPLETED","CANCELLED","ALL")}?:"PENDING"
 val leadId=query["leadId"]?.takeIf{runCatching{UUID.fromString(it).toString().equals(it,true)}.getOrDefault(false)}
 FollowUpNotificationTarget(status,leadId)
}.getOrDefault(FollowUpNotificationTarget())
