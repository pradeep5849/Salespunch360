package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class DashboardTrackingState(
    val loading: Boolean = false,
    val employees: List<DashboardEmployee> = emptyList(),
    val selectedEmployeeId: String? = null,
    val selectedCheckEmployeeId: String? = null,
    val latestLocation: LatestLocation? = null,
    val recentVisits: List<AdminDashboardVisit> = emptyList(),
    val gpsTrackingEnabled: Boolean? = null,
    val message: String? = null,
)

class DashboardViewModel(application: Application) : AndroidViewModel(application) {
    private val api = ApiClient(SecureSession(application))
    private val _state = MutableStateFlow(DashboardTrackingState())
    val state: StateFlow<DashboardTrackingState> = _state.asStateFlow()

    init { load() }

    fun load(checkEmployee: String? = _state.value.selectedCheckEmployeeId) {
        if (_state.value.loading) return
        _state.value = _state.value.copy(loading = true, message = null)
        viewModelScope.launch {
            runCatching { api.dashboard(checkEmployee = checkEmployee) }
                .onSuccess { result ->
                    val currentSelected = _state.value.selectedEmployeeId
                    val selected = currentSelected?.takeIf { id -> result.employees.any { it.id == id } }
                    _state.value = DashboardTrackingState(
                        loading = false,
                        employees = result.employees,
                        selectedEmployeeId = selected,
                        selectedCheckEmployeeId = result.checkUserId,
                        latestLocation = _state.value.latestLocation?.takeIf { selected != null && selected == currentSelected },
                        recentVisits = result.recentVisits,
                        gpsTrackingEnabled = result.gpsTrackingEnabled,
                    )
                }
                .onFailure {
                    _state.value = _state.value.copy(loading = false, message = "Unable to load dashboard data.")
                }
        }
    }

    fun select(employeeId: String) {
        _state.value = _state.value.copy(selectedEmployeeId = employeeId, latestLocation = null, message = null)
    }

    fun selectCheck(employeeId: String?) {
        _state.value = _state.value.copy(selectedCheckEmployeeId = employeeId)
        load(employeeId)
    }

    fun view() {
        val id = _state.value.selectedEmployeeId ?: return
        if (_state.value.loading) return
        _state.value = _state.value.copy(loading = true, message = null)
        viewModelScope.launch {
            runCatching {
                api.dashboard(liveEmployee = id, checkEmployee = _state.value.selectedCheckEmployeeId)
            }.onSuccess { result ->
                val selected = result.liveUserId ?: id
                _state.value = _state.value.copy(
                    loading = false,
                    employees = result.employees,
                    selectedEmployeeId = selected,
                    latestLocation = result.latestLocation,
                    recentVisits = result.recentVisits,
                    gpsTrackingEnabled = result.gpsTrackingEnabled,
                    message = if (result.latestLocation == null) "No stored GPS location is available for this employee." else null,
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, message = "Unable to load live tracking location.")
            }
        }
    }
}
