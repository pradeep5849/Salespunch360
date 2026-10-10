package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

data class AccountReportState(
    val loading: Boolean = false,
    val report: String? = null,
    val from: String = java.time.LocalDate.now().withDayOfYear(1).toString(),
    val to: String = java.time.LocalDate.now().toString(),
    val branchId: String = "",
    val projectId: String = "",
    val ledgerId: String = "",
    val customerId: String = "",
    val vendorId: String = "",
    val productId: String = "",
    val options: JsonObject = buildJsonObject {},
    val data: JsonObject? = null,
    val export: Pair<String, ByteArray>? = null,
    val error: String? = null
)

class AccountReportViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient(SecureSession(app))
    private val _state = MutableStateFlow(AccountReportState())
    val state: StateFlow<AccountReportState> = _state
    private var reportJob: Job? = null
    private var exportJob: Job? = null
    private var requestGeneration = 0L

    init { options() }

    private fun options() = viewModelScope.launch {
        try {
            _state.value = _state.value.copy(options = api.accountReportOptions())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            fail(e)
        }
    }

    fun context(query:String) {
        val q=android.net.Uri.parse("https://internal.invalid/?$query")
        _state.value=_state.value.copy(branchId=q.getQueryParameter("branchId").orEmpty(),from=q.getQueryParameter("from")?:_state.value.from,to=q.getQueryParameter("to")?:q.getQueryParameter("asOf")?:_state.value.to)
    }
    fun choose(report: String?) {
        requestGeneration++
        reportJob?.cancel()
        exportJob?.cancel()
        _state.value = _state.value.copy(report = report, data = null, export = null, loading = false, error = null)
        if (report != null) run()
    }

    fun dates(from: String, to: String) {
        _state.value = _state.value.copy(from = from, to = to)
    }

    fun filter(key: String, value: String) {
        _state.value = when (key) {
            "branch" -> _state.value.copy(branchId = value)
            "project" -> _state.value.copy(projectId = value)
            "ledger" -> _state.value.copy(ledgerId = value)
            "customer" -> _state.value.copy(customerId = value)
            "vendor" -> _state.value.copy(vendorId = value)
            else -> _state.value.copy(productId = value)
        }
    }

    private fun filters(report: String? = _state.value.report) = buildMap {
        val lifetimeProject = report == "projects" || report == "budget-vs-actual"
        if (!lifetimeProject) {
            put("from", _state.value.from)
            put("to", _state.value.to)
        }
        listOf(
            "branchId" to _state.value.branchId,
            "projectId" to _state.value.projectId,
            "ledgerId" to _state.value.ledgerId,
            "customerId" to _state.value.customerId,
            "vendorId" to _state.value.vendorId,
            "productId" to _state.value.productId
        ).forEach { (key, value) ->
            if (value.isNotBlank() && (!lifetimeProject || key == "branchId" || key == "projectId")) put(key, value)
        }
    }

    fun run() {
        val report = _state.value.report ?: return
        reportJob?.cancel()
        val generation = ++requestGeneration
        val requestFilters = filters(report)
        reportJob = viewModelScope.launch {
            try {
                _state.value = _state.value.copy(loading = true, error = null)
                val data = api.accountReport(report, requestFilters)
                if (generation == requestGeneration && _state.value.report == report) {
                    _state.value = _state.value.copy(loading = false, data = data)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (generation == requestGeneration && _state.value.report == report) fail(e)
            }
        }
    }

    fun export(format: String) {
        val report = _state.value.report ?: return
        exportJob?.cancel()
        val generation = requestGeneration
        val requestFilters = filters(report)
        exportJob = viewModelScope.launch {
            try {
                val bytes = api.accountReportExport(report, format, requestFilters)
                if (generation == requestGeneration && _state.value.report == report) {
                    _state.value = _state.value.copy(export = "$report.$format" to bytes)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (generation == requestGeneration && _state.value.report == report) fail(e)
            }
        }
    }

    fun consumed() { _state.value = _state.value.copy(export = null) }

    private fun fail(e: Exception) {
        _state.value = _state.value.copy(
            loading = false,
            error = if (e is IOException) "Offline. Report was not refreshed." else "Report request rejected by server."
        )
    }
}
