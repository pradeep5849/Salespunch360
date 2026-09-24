package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class LeadsState(
    val loading: Boolean = true,
    val leads: List<LeadSummary> = emptyList(),
    val pending: PendingLeadsContext = PendingLeadsContext(),
    val options: List<DashboardEmployee> = emptyList(),
    val telecallers: List<TelecallerOption> = emptyList(),
    val query: String = "",
    val employeeId: String? = null,
    val callCounts: Map<String, Int> = emptyMap(),
    val detail: LeadSummary? = null,
    val detailFollowUps: List<FollowUpTask> = emptyList(),
    val detailCallHistory: List<LeadCallHistoryItem> = emptyList(),
    val detailLoading: Boolean = false,
    val busy: Boolean = false,
    val message: String? = null,
)

class LeadsViewModel(app: Application) : AndroidViewModel(app) {
    private val session = SecureSession(app)
    private val api = ApiClient(session)
    private val telecalling = TelecallingClient(session)
    private val followUpMutations = FollowUpMutationClient(session)
    private val _state = MutableStateFlow(LeadsState())
    val state: StateFlow<LeadsState> = _state

    init { refresh() }
    fun setQuery(value: String) { _state.value = _state.value.copy(query = value.take(100)) }
    fun setEmployee(value: String?) { _state.value = _state.value.copy(employeeId = value) }

    fun refresh(q: String = _state.value.query, employee: String? = _state.value.employeeId) = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, message = null)
        _state.value = try {
            val leads = api.leads(q, employee)
            val counts = loadCallCounts()
            _state.value.copy(
                loading = false, leads = leads, pending = api.pendingLeads(),
                options = runCatching { api.leadOptions() }.getOrDefault(emptyList()),
                telecallers = runCatching { followUpMutations.telecallers() }.getOrDefault(emptyList()),
                query = q, employeeId = employee, callCounts = counts,
            )
        } catch (e: Exception) { _state.value.copy(loading = false, message = apiMessage(e, "Leads couldn't be loaded.")) }
    }

    fun open(id: String) = viewModelScope.launch {
        _state.value = _state.value.copy(detailLoading = true, detail = null, detailFollowUps = emptyList(), detailCallHistory = emptyList())
        _state.value = try {
            val detail = api.lead(id);val followUps = loadLeadFollowUps(id);val history = telecalling.history(id)
            _state.value.copy(detail = detail,detailFollowUps = followUps,detailCallHistory = history,callCounts = _state.value.callCounts + (id to history.size),detailLoading = false)
        } catch (e: Exception) { _state.value.copy(detailLoading = false, message = apiMessage(e, "Lead details couldn't be loaded.")) }
    }

    fun close() { _state.value = _state.value.copy(detail = null, detailFollowUps = emptyList(), detailCallHistory = emptyList(), detailLoading = false, message = null) }
    fun transition(lead: LeadSummary, stage: LeadStage, reason: String?) { mutate { api.transitionLead(lead.id, lead.version, stage, reason) } }

    fun followUp(lead: LeadSummary, dueDate: String, notes: String?, type: String, assignedUserId:String?=null) {
        if (_state.value.busy) return
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, message = null)
            try {
                followUpMutations.create(lead.id,dueDate,type,notes,assignedUserId)
                val detail = if(_state.value.detail?.id==lead.id) api.lead(lead.id) else _state.value.detail
                val followUps = if(_state.value.detail?.id==lead.id) loadLeadFollowUps(lead.id) else _state.value.detailFollowUps
                val list = api.leads(_state.value.query, _state.value.employeeId)
                val label = if (type == "CALL") "Call" else "Visit"
                _state.value = _state.value.copy(busy = false, detail = detail, detailFollowUps = followUps, leads = list, message = "$label follow-up added successfully.")
            } catch (e: Exception) { _state.value = _state.value.copy(busy = false, message = apiMessage(e, "Follow-up couldn't be added.")) }
        }
    }

    fun recordCall(
        lead: LeadSummary,
        result: String,
        notes: String?,
        nextCallbackAt: String?,
        dialStartedAt: String? = null,
        dialEndedAt: String? = null,
        timingSource: String? = null,
    ) {
        if (_state.value.busy) return
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, message = null)
            try {
                val saved = telecalling.recordCall(
                    lead.id,
                    result,
                    notes,
                    nextCallbackAt,
                    dialStartedAt = dialStartedAt,
                    dialEndedAt = dialEndedAt,
                    timingSource = timingSource,
                )
                val counts = loadCallCounts();val history = if (_state.value.detail?.id == lead.id) telecalling.history(lead.id) else _state.value.detailCallHistory
                _state.value = _state.value.copy(busy = false,callCounts = counts,detailCallHistory = history,message = if (saved.handoffCreated) "Call saved. Sales owner was notified." else "Call result saved.")
            } catch (e: Exception) { _state.value = _state.value.copy(busy = false, message = apiMessage(e, "Call result couldn't be saved.")) }
        }
    }

    fun edit(request: LeadEditRequest) {
        if (_state.value.busy) return
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, message = null)
            try {
                val detail = api.editLead(request);val list = api.leads(_state.value.query, _state.value.employeeId)
                _state.value = _state.value.copy(busy = false, detail = detail, leads = list, message = "Lead updated")
                delay(1800);if(_state.value.message=="Lead updated")_state.value=_state.value.copy(message=null)
            } catch (e: Exception) { _state.value = _state.value.copy(busy = false, message = apiMessage(e, "Lead update wasn't accepted.")) }
        }
    }

    fun delete(lead: LeadSummary) { mutate { api.deleteLead(lead.id) } }
    fun addPendingPhone(visit: PendingLeadVisit, phone: String) { mutate("Phone added. Lead created.") { api.addPendingPhone(visit.id, phone) } }
    fun clear() { _state.value = _state.value.copy(message = null) }

    private suspend fun loadCallCounts(): Map<String, Int> = runCatching { telecalling.queue().associate { it.id to it.calls } }.getOrDefault(emptyMap())
    private suspend fun loadLeadFollowUps(leadId: String): List<FollowUpTask> = listOf("TODAY", "OVERDUE", "PENDING", "COMPLETED", "CANCELLED").flatMap { api.followUps(it).tasks }.filter { it.leadId == leadId }.distinctBy { it.id }.sortedByDescending { it.createdAt ?: it.dueDate }

    private fun mutate(success: String = "Lead updated.", action: suspend () -> Unit) {
        if (_state.value.busy) return
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true)
            try { action();_state.value = _state.value.copy(loading = false,busy = false,leads = api.leads(_state.value.query, _state.value.employeeId),pending = api.pendingLeads(),callCounts = loadCallCounts(),detail = null,detailFollowUps = emptyList(),detailCallHistory = emptyList(),message = success) }
            catch (e: Exception) { _state.value = _state.value.copy(busy = false, message = apiMessage(e, "Lead update wasn't accepted.")) }
        }
    }
}
