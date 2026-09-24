package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.SecureSession
import com.salespunch360.mobile.data.TelecallingClient
import com.salespunch360.mobile.data.TelecallingSalesAction
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class SalesHandoffState(
    val loading: Boolean = true,
    val actions: List<TelecallingSalesAction> = emptyList(),
    val busyId: String? = null,
    val message: String? = null,
)

class SalesHandoffViewModel(app: Application) : AndroidViewModel(app) {
    private val api = TelecallingClient(SecureSession(app))
    private val _state = MutableStateFlow(SalesHandoffState())
    val state: StateFlow<SalesHandoffState> = _state

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, message = null)
        _state.value = try {
            _state.value.copy(loading = false, actions = api.salesActions())
        } catch (e: Exception) {
            _state.value.copy(loading = false, message = apiMessage(e, "Telecaller handoffs couldn't be loaded."))
        }
    }

    fun update(actionId: String, status: String) {
        if (_state.value.busyId != null) return
        viewModelScope.launch {
            _state.value = _state.value.copy(busyId = actionId, message = null)
            try {
                api.updateSalesAction(actionId, status)
                _state.value = _state.value.copy(
                    busyId = null,
                    actions = api.salesActions(),
                    message = if (status == "ACKNOWLEDGED") "Telecaller handoff acknowledged." else "Sales action marked completed.",
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(busyId = null, message = apiMessage(e, "Sales action couldn't be updated."))
            }
        }
    }

    fun clearMessage() { _state.value = _state.value.copy(message = null) }
}
