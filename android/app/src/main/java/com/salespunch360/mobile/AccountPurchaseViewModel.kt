package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

class AccountPurchaseViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient(SecureSession(app))
    private val _state = MutableStateFlow(PurchaseState())
    val state: StateFlow<PurchaseState> = _state

    private val creationIdentity = CommercialCreationIdentity()
    private var refreshJob: Job? = null
    private var refreshGeneration = 0

    init {
        refresh()
    }

    fun refresh() {
        refreshJob?.cancel()
        val generation = ++refreshGeneration
        val type = _state.value.type
        val query = _state.value.query
        refreshJob = viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val options = api.purchaseOptions()
                val rows = api.purchases(type, query)
                    .map { it.jsonObject }
                    .map {
                        SalesDocumentRow(
                            it.str("id"),
                            it.str("type"),
                            it.str("documentNumber"),
                            it.str("partyName"),
                            it.str("issueDate").take(10),
                            it.str("status"),
                            it.str("grandTotal")
                        )
                    }

                if (generation != refreshGeneration) return@launch
                _state.value = _state.value.copy(
                    loading = false,
                    rows = rows,
                    types = options["allowedDocumentTypes"]?.jsonArray?.map { it.jsonPrimitive.content }.orEmpty(),
                    branches = options.array("branches").map { it.option() },
                    vendors = options.array("vendors").map { it.option() },
                    products = options.array("products").map { it.option("costPrice") },
                    services = options.array("services").map { it.option("estimatedCost") },
                    workPackages = options.array("workPackages").map { it.option("estimatedCost") },
                    warehouses = options.array("warehouses").map { it.option() },
                    projects = options.array("projects").map { it.option() },
                    projectBudgetLines = options.array("projectBudgetLines"),
                    batches = options.array("batches"),
                    serials = options.array("serials"),
                    sources = options.array("sourceDocuments"),
                    purchaseOrders = options.array("purchaseOrders")
                )
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (generation == refreshGeneration) _state.value = _state.value.copy(loading = false, error = errorText(e))
            }
        }
    }

    fun search(query: String) {
        _state.value = _state.value.copy(query = query)
        refresh()
    }

    fun filter(type: String?) {
        _state.value = _state.value.copy(type = type)
        refresh()
    }

    fun create(type: String, projectId:String?=null) {
        if (_state.value.saving || type !in _state.value.types) return
        val project = _state.value.projects.firstOrNull { it.id == projectId }
        if (!projectId.isNullOrBlank() && project == null) {
            _state.value = _state.value.copy(error = "This Project is unavailable.")
            return
        }
        creationIdentity.reset()
        _state.value = _state.value.copy(
            draft = PurchaseDraft(
                type = type,
                branchId = project?.branchId ?: _state.value.branches.firstOrNull()?.id.orEmpty(),
                purpose=if(projectId.isNullOrBlank())"INVENTORY_SALES" else "PROJECT",
                projectId=projectId.orEmpty()
            )
        )
    }

    fun edit(draft: PurchaseDraft) {
        if (_state.value.saving) return
        _state.value = _state.value.copy(draft = draft)
    }

    fun closeDraft() {
        if (_state.value.saving) return
        _state.value = _state.value.copy(draft = null)
    }

    fun addLine() {
        _state.value.draft?.let {
            edit(it.copy(lines = it.lines + SalesLineDraft(lineType = "MATERIAL")))
        }
    }

    fun line(index: Int, line: SalesLineDraft) {
        _state.value.draft?.let {
            edit(it.copy(lines = it.lines.mapIndexed { i, current -> if (i == index) line else current }))
        }
    }

    fun remove(index: Int) {
        _state.value.draft?.let {
            if (it.lines.size > 1) {
                edit(it.copy(lines = it.lines.filterIndexed { i, _ -> i != index }))
            }
        }
    }

    fun save() {
        if (_state.value.saving) return
        val draft = _state.value.draft ?: return
        purchaseValidation(draft, _state.value)?.let {
            _state.value = _state.value.copy(error = it)
            return
        }
        _state.value = _state.value.copy(saving = true, error = null)
        viewModelScope.launch {
            try {
                val payload = creationIdentity.payload(purchasePayload(draft))

                val created = api.createPurchase(payload)
                val id = created.str("id")
                creationIdentity.reset()
                _state.value = _state.value.copy(
                    saving = false,
                    draft = null,
                    message = "Purchase draft created with server totals."
                )
                open(id)
                refresh()
            } catch (e: Exception) {
                fail(e)
            }
        }
    }

    fun open(id: String) = viewModelScope.launch {
        try {
            _state.value = _state.value.copy(detail = api.purchase(id))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            _state.value = _state.value.copy(error = errorText(e))
        }
    }

    fun close() {
        _state.value = _state.value.copy(detail = null)
    }

    fun askPost(id: String) {
        _state.value = _state.value.copy(posting = id)
    }

    fun cancelPost() {
        if (_state.value.saving) return
        _state.value = _state.value.copy(posting = null)
    }

    fun post() {
        if (_state.value.saving) return
        val id = _state.value.posting ?: return
        _state.value = _state.value.copy(saving = true, error = null)
        viewModelScope.launch {
            try {
                api.postPurchase(id)
                _state.value = _state.value.copy(
                    posting = null,
                    saving = false,
                    detail = api.purchase(id),
                    message = "Purchase document posted by the server."
                )
                refresh()
            } catch (e: Exception) {
                fail(e)
            }
        }
    }

    private fun fail(e: Exception) {
        if (e is CancellationException) throw e
        _state.value = _state.value.copy(
            loading = false,
            saving = false,
            error = errorText(e)
        )
    }

    private fun errorText(e: Exception) = when {
        e is IOException -> "Connection interrupted. Your inputs were kept; retry the same request when online."
        e is ApiException && e.status == 403 -> "You are not authorized for this purchase action."
        e is ApiException -> e.serverMessage ?: "The server rejected this purchase action (${e.code ?: e.status})."
        else -> "The server rejected this purchase action."
    }
}
