package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import com.salespunch360.mobile.ui.MobileRouteSignal
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.supervisorScope

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
    private var initialLoadTriggered = false

    init {
        viewModelScope.launch {
            MobileRouteSignal.current.collect { route ->
                if (route == "Leads" && !initialLoadTriggered) {
                    initialLoadTriggered = true
                    refresh()
                }
            }
        }
    }

    fun setQuery(value: String) { _state.value = _state.value.copy(query = value.take(100)) }
    fun setEmployee(value: String?) { _state.value = _state.value.copy(employeeId = value) }

    fun refresh(q: String = _state.value.query, employee: String? = _state.value.employeeId) = viewModelScope.launch {
        initialLoadTriggered = true
        _state.value = _state.value.copy(loading = true, message = null)
        val current = _state.value
        _state.value = try {
            coroutineScope {
                val leadsDeferred = async { api.leads(q, employee) }
                val countsDeferred = async { loadCallCounts() }
                val pendingDeferred = async { api.pendingLeads() }
                val optionsDeferred = async { runCatching { api.leadOptions() }.getOrDefault(emptyList()) }
                val telecallersDeferred = async { runCatching { followUpMutations.telecallers() }.getOrDefault(emptyList()) }
                current.copy(
                    loading = false,
                    leads = leadsDeferred.await(),
                    pending = pendingDeferred.await(),
                    options = optionsDeferred.await(),
                    telecallers = telecallersDeferred.await(),
                    query = q,
                    employeeId = employee,
                    callCounts = countsDeferred.await(),
                )
            }
        } catch (e: Exception) {
            current.copy(loading = false, message = apiMessage(e, "Leads couldn't be loaded."))
        }
    }

    fun open(id: String) = viewModelScope.launch {
        val cached = _state.value.leads.firstOrNull { it.id == id }
        _state.value = _state.value.copy(
            detailLoading = cached == null,
            detail = cached,
            detailFollowUps = emptyList(),
            detailCallHistory = emptyList(),
            message = null,
        )
        try {
            val detail = api.lead(id)
            _state.value = _state.value.copy(detail = detail, detailLoading = false)
            supervisorScope {
                val followUpsDeferred = async { runCatching { loadLeadFollowUps(id) }.getOrDefault(emptyList()) }
                val historyDeferred = async { runCatching { telecalling.history(id) }.getOrDefault(emptyList()) }
                val followUps = followUpsDeferred.await()
                val history = historyDeferred.await()
                _state.value = _state.value.copy(
                    detail = detail,
                    detailFollowUps = followUps,
                    detailCallHistory = history,
                    callCounts = _state.value.callCounts + (id to history.size),
                    detailLoading = false,
                )
            }
        } catch (e: Exception) {
            _state.value = _state.value.copy(
                detailLoading = false,
                detail = cached,
                message = apiMessage(e, "Lead details couldn't be loaded."),
            )
        }
    }

    fun close() { _state.value = _state.value.copy(detail = null, detailFollowUps = emptyList(), detailCallHistory = emptyList(), detailLoading = false, message = null) }
    fun transition(lead: LeadSummary, stage: LeadStage, reason: String?) { mutate { api.transitionLead(lead.id, lead.version, stage, reason) } }

    fun followUp(lead: LeadSummary, dueDate: String, notes: String?, type: String, assignedUserId:String?=null) {
        if (_state.value.busy) return
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, message = null)
            try {
                followUpMutations.create(lead.id,dueDate,type,notes,assignedUserId)
                val detailOpen = _state.value.detail?.id == lead.id
                val label = if (type == "CALL") "Call" else "Visit"
                val success = "$label follow-up added successfully."
                coroutineScope {
                    val detailDeferred = async { if (detailOpen) api.lead(lead.id) else _state.value.detail }
                    val followUpsDeferred = async { if (detailOpen) loadLeadFollowUps(lead.id) else _state.value.detailFollowUps }
                    val listDeferred = async { api.leads(_state.value.query, _state.value.employeeId) }
                    _state.value = _state.value.copy(
                        busy = false,
                        detail = detailDeferred.await(),
                        detailFollowUps = followUpsDeferred.await(),
                        leads = listDeferred.await(),
                        message = success,
                    )
                }
                clearSuccessAfter(success)
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
                val success = if (saved.handoffCreated) "Call saved. Sales owner was notified." else "Call result saved."
                coroutineScope {
                    val countsDeferred = async { loadCallCounts() }
                    val historyDeferred = async {
                        if (_state.value.detail?.id == lead.id) telecalling.history(lead.id) else _state.value.detailCallHistory
                    }
                    _state.value = _state.value.copy(
                        busy = false,
                        callCounts = countsDeferred.await(),
                        detailCallHistory = historyDeferred.await(),
                        message = success,
                    )
                }
                clearSuccessAfter(success)
            } catch (e: Exception) { _state.value = _state.value.copy(busy = false, message = apiMessage(e, "Call result couldn't be saved.")) }
        }
    }

    fun edit(request: LeadEditRequest) {
        if (_state.value.busy) return
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, message = null)
            try {
                val detail = api.editLead(request)
                val list = api.leads(_state.value.query, _state.value.employeeId)
                val success = "Lead updated"
                _state.value = _state.value.copy(busy = false, detail = detail, leads = list, message = success)
                clearSuccessAfter(success)
            } catch (e: Exception) { _state.value = _state.value.copy(busy = false, message = apiMessage(e, "Lead update wasn't accepted.")) }
        }
    }

    fun delete(lead: LeadSummary) { mutate { api.deleteLead(lead.id) } }
    fun addPendingPhone(visit: PendingLeadVisit, phone: String) { mutate("Phone added. Lead created.") { api.addPendingPhone(visit.id, phone) } }
    fun clear() { _state.value = _state.value.copy(message = null) }

    private suspend fun loadCallCounts(): Map<String, Int> = runCatching { telecalling.queue().associate { it.id to it.calls } }.getOrDefault(emptyMap())
    private suspend fun loadLeadFollowUps(leadId: String): List<FollowUpTask> = coroutineScope {
        listOf("TODAY", "OVERDUE", "PENDING", "COMPLETED", "CANCELLED")
            .map { bucket -> async { api.followUps(bucket).tasks } }
            .awaitAll()
            .flatten()
            .filter { it.leadId == leadId }
            .distinctBy { it.id }
            .sortedByDescending { it.createdAt ?: it.dueDate }
    }

    private suspend fun clearSuccessAfter(success: String) {
        delay(2500)
        if (_state.value.message == success) _state.value = _state.value.copy(message = null)
    }

    private fun mutate(success: String = "Lead updated.", action: suspend () -> Unit) {
        if (_state.value.busy) return
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true)
            try {
                action()
                coroutineScope {
                    val leadsDeferred = async { api.leads(_state.value.query, _state.value.employeeId) }
                    val pendingDeferred = async { api.pendingLeads() }
                    val countsDeferred = async { loadCallCounts() }
                    _state.value = _state.value.copy(
                        loading = false,
                        busy = false,
                        leads = leadsDeferred.await(),
                        pending = pendingDeferred.await(),
                        callCounts = countsDeferred.await(),
                        detail = null,
                        detailFollowUps = emptyList(),
                        detailCallHistory = emptyList(),
                        message = success,
                    )
                }
                clearSuccessAfter(success)
            } catch (e: Exception) { _state.value = _state.value.copy(busy = false, message = apiMessage(e, "Lead update wasn't accepted.")) }
        }
    }
}
