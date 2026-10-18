package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.account.AppliedAccountReport
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
    val favouriteSaving:Boolean=false,
    val report: String? = null,
    val from: String = com.salespunch360.mobile.account.accountReportFinancialYearStart().toString(),
    val to: String = com.salespunch360.mobile.account.accountReportToday().toString(),
    val branchId: String = "",
    val projectId: String = "",
    val ledgerId: String = "",
    val customerId: String = "",
    val vendorId: String = "",
    val productId: String = "",
    val ownerId: String = "",
    val accountType:String="",
    val moneyAccountId:String="",
    val categoryId:String="",
    val itemStatus:String="",
    val itemSearch:String="",
    val stockLevel:String="",
    val options: JsonObject = buildJsonObject {},
    val data: JsonObject? = null,
    val appliedFilters: Map<String,String> = emptyMap(),
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
    private var appliedRequest: AppliedAccountReport? = null

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

    fun favourite(key:String,selected:Boolean)=viewModelScope.launch{
        if(_state.value.favouriteSaving)return@launch
        _state.value=_state.value.copy(favouriteSaving=true,error=null)
        try{val result=api.setAccountReportFavourite(key,selected);_state.value=_state.value.copy(favouriteSaving=false,options=JsonObject(_state.value.options.toMutableMap().apply{put("favourites",result["favourites"]?:JsonArray(emptyList()))}))}
        catch(error:CancellationException){throw error}
        catch(error:Exception){_state.value=_state.value.copy(favouriteSaving=false);fail(error)}
    }

    fun context(query:String) {
        val q=android.net.Uri.parse("https://internal.invalid/?$query")
        _state.value=_state.value.copy(itemSearch=q.getQueryParameter("itemSearch").orEmpty(),stockLevel=q.getQueryParameter("stockLevel").orEmpty(),moneyAccountId=q.getQueryParameter("moneyAccountId").orEmpty(),categoryId=q.getQueryParameter("categoryId").orEmpty(),itemStatus=q.getQueryParameter("itemStatus").orEmpty(),accountType=q.getQueryParameter("accountType").orEmpty(),branchId=q.getQueryParameter("branchId").orEmpty(),from=q.getQueryParameter("from")?:_state.value.from,to=q.getQueryParameter("to")?:q.getQueryParameter("asOf")?:_state.value.to)
    }
    fun choose(report: String?) {
        requestGeneration++
        appliedRequest = null
        reportJob?.cancel()
        exportJob?.cancel()
        _state.value = _state.value.copy(report = report, data = null, appliedFilters = emptyMap(), export = null, loading = false, error = null)
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
            "owner" -> _state.value.copy(ownerId = value)
            "moneyAccountId" -> _state.value.copy(moneyAccountId=value)
            "categoryId" -> _state.value.copy(categoryId=value)
            "stockLevel" -> _state.value.copy(stockLevel=value)
            "itemSearch" -> _state.value.copy(itemSearch=value)
            "itemStatus" -> _state.value.copy(itemStatus=value)
            "accountType" -> _state.value.copy(accountType=value)
            else -> _state.value.copy(productId = value)
        }
    }

    private fun filters(report: String? = _state.value.report) = com.salespunch360.mobile.account.accountReportRequestFilters(
        _state.value.options,report.orEmpty(),mapOf(
            "from" to _state.value.from,"to" to _state.value.to,
            "branchId" to _state.value.branchId,"projectId" to _state.value.projectId,
            "ledgerId" to _state.value.ledgerId,"customerId" to _state.value.customerId,
            "vendorId" to _state.value.vendorId,"ownerId" to _state.value.ownerId,
            "moneyAccountId" to _state.value.moneyAccountId,"categoryId" to _state.value.categoryId,"itemSearch" to _state.value.itemSearch,"itemStatus" to _state.value.itemStatus,"stockLevel" to _state.value.stockLevel,
            "productId" to _state.value.productId,"accountType" to _state.value.accountType
        )
    )

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
                    appliedRequest = AppliedAccountReport(report, requestFilters)
                    _state.value = _state.value.copy(loading = false, data = data, appliedFilters = requestFilters)
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
        val shown = appliedRequest?.takeIf { it.report == report && _state.value.data != null } ?: return
        exportJob?.cancel()
        val generation = requestGeneration
        val requestFilters = shown.filters
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
