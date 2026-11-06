package com.salespunch360.mobile.data
import kotlinx.serialization.Serializable
@Serializable data class AuditActorName(val name:String)
@Serializable data class AccountAuditRow(val id:String,val eventType:String,val entityType:String,val entityId:String,val createdAt:String,val actor:AuditActorName)
@Serializable data class AccountAuditPage(val rows:List<AccountAuditRow>,val nextCursor:String?=null)
