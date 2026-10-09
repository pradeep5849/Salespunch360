package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.account.str
import com.salespunch360.mobile.data.*
import java.io.IOException
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

data class ProjectState(
    val loading: Boolean = false, val saving: Boolean = false,
    val query: String = "", val status: String? = null,
    val rows: List<JsonObject> = emptyList(), val options: JsonObject = buildJsonObject {},
    val metrics: JsonObject = buildJsonObject {}, val detail: JsonObject? = null,
    val costing: JsonObject? = null, val editing: JsonObject? = null,
    val error: String? = null, val budgetEditing: Boolean = false,
    val changeEditing: ProjectChangeDraft? = null,
)
class AccountProjectViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient(SecureSession(app))
    private val _state = MutableStateFlow(ProjectState())
    val state: StateFlow<ProjectState> = _state
    private var listJob: Job? = null
    private var detailGeneration = 0
    private var initialRouteKey: String? = null
    private suspend fun optionalCosting(id: String, options: JsonObject): JsonObject? =
        if (options["capabilities"]?.jsonObject?.get("costView")?.jsonPrimitive?.booleanOrNull == true) api.projectCosting(id) else null
    init { load() }
    fun initialRoute(projectId: String?, createMode: Boolean) {
        val key = "$projectId:$createMode"
        if (initialRouteKey == key) return
        initialRouteKey = key
        if (createMode) create() else if (!projectId.isNullOrBlank()) open(projectId)
    }
    fun load() {
        listJob?.cancel()
        val query = _state.value.query; val status = _state.value.status
        listJob = viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val result = api.projects(query, status)
                val options = api.projectOptions()
                _state.value = _state.value.copy(loading = false, rows = result["rows"]?.jsonArray?.map { it.jsonObject }.orEmpty(), metrics = result["metrics"]?.jsonObject ?: buildJsonObject {}, options = options)
            } catch (e: CancellationException) { throw e } catch (e: Exception) { fail(e) }
        }
    }
    fun search(query: String) { _state.value = _state.value.copy(query = query); load() }
    fun filter(status: String?) { _state.value = _state.value.copy(status = status); load() }
    fun create() { _state.value = _state.value.copy(editing = buildJsonObject {}, error = null) }
    fun action(id: String, action: String) = viewModelScope.launch {
        if (_state.value.saving) return@launch
        _state.value = _state.value.copy(saving = true, error = null)
        try { api.projectAction(id, action); _state.value = _state.value.copy(saving = false); open(id); load() } catch (e: Exception) { fail(e) }
    }
    fun editBudget(value: Boolean = true) { if (!_state.value.saving) _state.value = _state.value.copy(budgetEditing = value, error = null) }
    fun saveBudget(id: String, lines: List<ProjectBudgetLineDraft>) = viewModelScope.launch {
        if (_state.value.saving || !validProjectBudget(lines)) return@launch
        _state.value = _state.value.copy(saving = true, error = null)
        try {
            val detail = api.saveProjectBudget(id, projectBudgetPayload(lines))
            _state.value = _state.value.copy(detail = detail, budgetEditing = false, saving = false, costing = optionalCosting(id, _state.value.options))
        } catch (e: Exception) { fail(e) }
    }
    fun edit() { _state.value = _state.value.copy(editing = _state.value.detail, error = null) }
    fun close() {
        if (_state.value.saving) return
        detailGeneration++
        _state.value = _state.value.copy(editing = null, detail = null, costing = null, changeEditing = null)
    }
    fun open(id: String) = viewModelScope.launch {
        val generation = ++detailGeneration
        try {
            val options = api.projectOptions(id)
            val detail = api.project(id)
            val costing = optionalCosting(id, options)
            if (generation == detailGeneration) _state.value = _state.value.copy(detail = detail, costing = costing, options = options, error = null)
        } catch (e: Exception) { if (generation == detailGeneration) fail(e) }
    }
    fun save(payload: JsonObject) = viewModelScope.launch {
        if (_state.value.saving) return@launch
        _state.value = _state.value.copy(saving = true, error = null)
        try {
            val edit = _state.value.editing?.containsKey("id") == true
            val detail = api.saveProject(edit, payload)
            _state.value = _state.value.copy(saving = false, editing = null, detail = detail, costing = optionalCosting(detail.str("id"), _state.value.options))
            load()
        } catch (e: Exception) { fail(e) }
    }
    fun editChange(row: JsonObject? = null) {
        if (_state.value.saving) return
        _state.value = _state.value.copy(error = null, changeEditing = row?.let { ProjectChangeDraft(it.str("id"), it.str("title"), it.str("description"), it.str("valueDelta"), it.str("estimatedCostDelta")) } ?: ProjectChangeDraft())
    }
    fun updateChange(edit: (ProjectChangeDraft) -> ProjectChangeDraft) {
        if (_state.value.saving) return
        _state.value.changeEditing?.let { _state.value = _state.value.copy(changeEditing = edit(it).copy(requestKey = UUID.randomUUID().toString()), error = null) }
    }
    fun closeChange() { if (!_state.value.saving) _state.value = _state.value.copy(changeEditing = null) }
    fun saveChange() = viewModelScope.launch {
        val row = _state.value.changeEditing ?: return@launch
        val projectId = _state.value.detail?.str("id") ?: return@launch
        if (_state.value.saving || !validProjectChange(row)) return@launch
        _state.value = _state.value.copy(saving = true, error = null)
        try {
            val costing = api.projectChangeOrder(projectId, projectChangePayload(row))
            _state.value = _state.value.copy(saving = false, changeEditing = null, costing = costing)
            load()
        } catch (e: Exception) { fail(e) }
    }
    fun transitionChange(id: String, operation: String) = viewModelScope.launch {
        val projectId = _state.value.detail?.str("id") ?: return@launch
        if (_state.value.saving) return@launch
        _state.value = _state.value.copy(saving = true, error = null)
        try {
            val costing = api.projectChangeOrder(projectId, buildJsonObject { put("operation", operation); put("changeOrderId", id) })
            _state.value = _state.value.copy(saving = false, costing = costing)
            load()
        } catch (e: Exception) { fail(e) }
    }
    private fun fail(error: Exception) {
        if (error is CancellationException) throw error
        _state.value = _state.value.copy(loading = false, saving = false, error = when (error) {
            is IOException -> "Connection interrupted. Your inputs were kept; reload current status before retrying."
            is ApiException -> error.serverMessage ?: "Project action rejected by server."
            else -> "Project action rejected by server."
        })
    }
}
