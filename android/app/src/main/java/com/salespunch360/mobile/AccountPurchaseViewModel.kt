package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.data.*
import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

class AccountPurchaseViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient(SecureSession(app))
    private val _state = MutableStateFlow(PurchaseState())
    val state: StateFlow<PurchaseState> = _state

    init {
        refresh()
    }

    fun refresh() = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, error = null)
        try {
            val options = api.purchaseOptions()
            val rows = api.purchases(_state.value.type, _state.value.query)
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
                sources = options.array("sourceDocuments"),
                purchaseOrders = options.array("purchaseOrders")
            )
        } catch (e: Exception) {
            fail(e)
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

    fun create(type: String) {
        _state.value = _state.value.copy(
            draft = PurchaseDraft(
                type = type,
                branchId = _state.value.branches.firstOrNull()?.id.orEmpty()
            )
        )
    }

    fun edit(draft: PurchaseDraft) {
        _state.value = _state.value.copy(draft = draft)
    }

    fun closeDraft() {
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
        val draft = _state.value.draft ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(saving = true, error = null)
            try {
                val payload = buildJsonObject {
                    put("type", draft.type)
                    put("branchId", draft.branchId)
                    put("partyId", draft.vendorId)
                    draft.sourceDocumentId.takeIf { it.isNotBlank() }?.let { put("sourceDocumentId", it) }
                    draft.sourcePurchaseOrderId.takeIf { it.isNotBlank() }?.let { put("sourcePurchaseOrderId", it) }
                    put("purchasePurpose", draft.purpose)
                    put("purchaseClassification", draft.classification)
                    draft.projectId.takeIf { it.isNotBlank() }?.let { put("projectId", it) }
                    put("issueDate", draft.issueDate)
                    draft.dueDate.takeIf { it.isNotBlank() }?.let { put("dueDate", it) }
                    put("taxMode", draft.taxMode)
                    draft.stateOfSupplyCode.takeIf { it.isNotBlank() }?.let { put("stateOfSupplyCode", it) }
                    put("reverseCharge", draft.reverseCharge)
                    put("taxCreditTreatment", draft.taxCreditTreatment)
                    put("tdsRate", draft.tdsRate)
                    put("notes", draft.notes)
                    putJsonArray("lines") {
                        draft.lines.forEach { line ->
                            add(
                                buildJsonObject {
                                    put("lineType", line.lineType)
                                    line.sourceId.takeIf { it.isNotBlank() }?.let { put("sourceId", it) }
                                    line.itemName.takeIf { it.isNotBlank() }?.let { put("itemName", it) }
                                    put("quantity", line.quantity)
                                    line.rate.takeIf { it.isNotBlank() }?.let { put("rate", it) }
                                    line.discountType.takeIf { it.isNotBlank() }?.let {
                                        put("discountType", it)
                                        put("discountValue", line.discountValue)
                                    }
                                    line.taxRate.takeIf { it.isNotBlank() }?.let { put("taxRate", it) }
                                    line.warehouseId.takeIf { it.isNotBlank() }?.let { put("warehouseId", it) }
                                    line.sourceCommercialLineId.takeIf { it.isNotBlank() }?.let {
                                        put("sourceCommercialLineId", it)
                                    }
                                    put("stockReturnQuantity", line.stockReturnQuantity)
                                }
                            )
                        }
                    }
                }

                val created = api.createPurchase(payload)
                val id = created.str("id")
                _state.value = _state.value.copy(
                    saving = false,
                    draft = null,
                    detail = api.purchase(id),
                    message = "Purchase draft created with server totals."
                )
                refresh()
            } catch (e: Exception) {
                fail(e)
            }
        }
    }

    fun open(id: String) = viewModelScope.launch {
        try {
            _state.value = _state.value.copy(detail = api.purchase(id))
        } catch (e: Exception) {
            fail(e)
        }
    }

    fun close() {
        _state.value = _state.value.copy(detail = null)
    }

    fun askPost(id: String) {
        _state.value = _state.value.copy(posting = id)
    }

    fun cancelPost() {
        _state.value = _state.value.copy(posting = null)
    }

    fun post() = viewModelScope.launch {
        val id = _state.value.posting ?: return@launch
        try {
            api.postPurchase(id)
            _state.value = _state.value.copy(
                posting = null,
                detail = api.purchase(id),
                message = "Purchase document posted by the server."
            )
            refresh()
        } catch (e: Exception) {
            fail(e)
        }
    }

    private fun fail(e: Exception) {
        _state.value = _state.value.copy(
            loading = false,
            saving = false,
            error = when {
                e is IOException -> "You're offline. No purchase change was confirmed."
                e is ApiException && e.status == 403 -> "You are not authorized for this purchase action."
                else -> "The server rejected this purchase action."
            }
        )
    }
}
