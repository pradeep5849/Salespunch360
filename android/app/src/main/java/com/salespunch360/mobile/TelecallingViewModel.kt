package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.CallbackQueueItem
import com.salespunch360.mobile.data.LeadCallHistoryItem
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.data.TelecallingClient
import com.salespunch360.mobile.data.TelecallingLead
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class TelecallingState(
    val loading: Boolean = true,
    val queue: List<TelecallingLead> = emptyList(),
    val callbacks: List<CallbackQueueItem> = emptyList(),
    val historyLead: TelecallingLead? = null,
    val history: List<LeadCallHistoryItem> = emptyList(),
    val query: String = "",
    val searched: Boolean = false,
    val busy: Boolean = false,
    val message: String? = null,
)

class TelecallingViewModel(app: Application) : AndroidViewModel(app) {
    private val api = TelecallingClient(SecureSession(app))
    private val _state = MutableStateFlow(TelecallingState())
    val state: StateFlow<TelecallingState> = _state

    init { refresh(search = false) }
    fun setQuery(value: String) { _state.value = _state.value.copy(query = value.take(100)) }
    fun search(){ _state.value=_state.value.copy(searched=true);refresh(search=true) }

    fun refresh(search:Boolean=_state.value.searched) = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, message = null)
        _state.value = try {
            val queue = if(search&&_state.value.query.isNotBlank())api.queue(_state.value.query) else emptyList()
            val callbacks = api.callbacks()
            _state.value.copy(loading = false, queue = queue, callbacks = callbacks,searched=search)
        } catch (e: Exception) { _state.value.copy(loading = false, message = apiMessage(e, "Telecalling queue couldn't be loaded.")) }
    }

    fun openHistory(lead: TelecallingLead) = viewModelScope.launch {
        _state.value = _state.value.copy(historyLead = lead, history = emptyList(), busy = true, message = null)
        _state.value = try { _state.value.copy(busy = false, history = api.history(lead.id)) }
        catch (e: Exception) { _state.value.copy(busy = false, message = apiMessage(e, "Call history couldn't be loaded.")) }
    }
    fun closeHistory() { _state.value = _state.value.copy(historyLead = null, history = emptyList()) }

    fun recordCall(lead: TelecallingLead, result: String, notes: String?, nextCallbackAt: String?,followUpTaskId:String?=null) {
        if (_state.value.busy) return
        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, message = null)
            try {
                val saved = api.recordCall(lead.id, result, notes, nextCallbackAt,followUpTaskId)
                val queue = if(_state.value.searched&&_state.value.query.isNotBlank())api.queue(_state.value.query) else emptyList()
                val callbacks = api.callbacks()
                val history = if (_state.value.historyLead?.id == lead.id) api.history(lead.id) else _state.value.history
                _state.value = _state.value.copy(busy = false,queue = queue,callbacks = callbacks,history = history,historyLead = _state.value.historyLead?.let { current -> queue.firstOrNull { it.id == current.id } ?: current },message = if (saved.handoffCreated) "Call saved. Sales owner was notified." else "Call result saved.")
            } catch (e: Exception) { _state.value = _state.value.copy(busy = false, message = apiMessage(e, "Call result couldn't be saved.")) }
        }
    }
    fun clearMessage() { _state.value = _state.value.copy(message = null) }
}
