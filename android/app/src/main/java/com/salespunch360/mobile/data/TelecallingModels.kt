package com.salespunch360.mobile.data

import kotlinx.serialization.Serializable

@Serializable
data class TelecallingLead(
    val id: String,
    val title: String,
    val contactName: String? = null,
    val phone: String? = null,
    val stage: String,
    val assignedUserId: String,
    val ownerName: String,
    val calls: Int = 0,
)

@Serializable
data class LeadCallHistoryItem(
    val id: String,
    val leadId: String,
    val callerUserId: String,
    val callerName: String,
    val result: String,
    val notes: String? = null,
    val calledAt: String,
    val nextCallbackAt: String? = null,
    val callbackAssigneeUserId: String? = null,
)

@Serializable
data class CallbackQueueItem(
    val id: String,
    val leadId: String,
    val callerUserId: String,
    val callerName: String,
    val result: String,
    val notes: String? = null,
    val calledAt: String,
    val nextCallbackAt: String? = null,
    val callbackAssigneeUserId: String? = null,
    val leadTitle: String,
    val phone: String? = null,
    val ownerName: String,
)

@Serializable
data class TelecallingSalesAction(
    val id: String,
    val leadId: String,
    val leadTitle: String,
    val phone: String? = null,
    val leadCallId: String,
    val assignedUserId: String,
    val ownerName: String,
    val createdByUserId: String,
    val callerName: String,
    val trigger: String,
    val status: String,
    val notes: String? = null,
    val calledAt: String,
    val createdAt: String,
)

@Serializable
data class RecordLeadCallRequest(
    val action: String = "RECORD_CALL",
    val leadId: String,
    val result: String,
    val notes: String? = null,
    val nextCallbackAt: String? = null,
)

@Serializable
data class RecordLeadCallResponse(
    val id: String,
    val result: String,
    val handoffCreated: Boolean = false,
)

@Serializable
data class UpdateSalesActionRequest(
    val action: String = "UPDATE_SALES_ACTION",
    val actionId: String,
    val status: String,
)

val TELECALLING_RESULT_OPTIONS = listOf(
    "CONNECTED" to "Connected",
    "NO_ANSWER" to "No Answer",
    "BUSY" to "Busy",
    "NOT_REACHABLE" to "Not Reachable",
    "WRONG_NUMBER" to "Wrong Number",
    "CALL_BACK" to "Call Back",
    "NOT_INTERESTED" to "Not Interested",
    "INTERESTED" to "Interested",
    "WANTS_VISIT" to "Wants Visit",
    "WANTS_QUOTATION" to "Wants Quotation",
)

fun telecallingResultLabel(value: String) = TELECALLING_RESULT_OPTIONS.firstOrNull { it.first == value }?.second
    ?: value.replace('_', ' ').lowercase().replaceFirstChar { it.uppercase() }
