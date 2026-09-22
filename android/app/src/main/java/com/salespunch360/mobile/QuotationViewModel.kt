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

data class QuotationDraft(
    val id: String? = null,
    val revision: Boolean = false,
    val branchId: String = "",
    val customerId: String = "",
    val documentType: String = "QUOTATION",
    val issueDate: String = java.time.LocalDate.now().toString(),
    val validUntil: String = "",
    val terms: String = "",
    val inclusions: String = "",
    val exclusions: String = "",
    val notes: String = "",
    val lines: List<SalesLineDraft> = listOf(SalesLineDraft())
)

data class QuotationRow(
    val id: String,
    val number: String,
    val type: String,
    val customer: String,
    val status: String,
    val total: String,
    val revision: Int
)

data class QuotationState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val query: String = "",
    val status: String? = null,
    val rows: List<QuotationRow> = emptyList(),
    val branches: List<SalesOption> = emptyList(),
    val customers: List<SalesOption> = emptyList(),
    val products: List<SalesOption> = emptyList(),
    val services: List<SalesOption> = emptyList(),
    val workPackages: List<SalesOption> = emptyList(),
    val units: List<SalesOption> = emptyList(),
    val draft: QuotationDraft? = null,
    val detail: JsonObject? = null,
    val pdf: ByteArray? = null,
    val shareToken: String? = null,
    val error: String? = null,
    val message: String? = null
)

class QuotationViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient(SecureSession(app))
    private val _state = MutableStateFlow(QuotationState())
    val state: StateFlow<QuotationState> = _state

    init {
        refresh()
    }

    fun refresh() = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, error = null)
        try {
            val options = api.quotationOptions()
            val rows = api.quotations(_state.value.query, _state.value.status)
                .map { it.jsonObject }
                .map {
                    val revision = it.array("revisions").firstOrNull()
                    QuotationRow(
                        it.str("id"),
                        it.str("documentNumber"),
                        it.str("documentType"),
                        revision?.str("customerName").orEmpty(),
                        it.str("status"),
                        revision?.str("grandTotal").orEmpty(),
                        it.str("currentRevisionNumber").toIntOrNull() ?: 0
                    )
                }

            _state.value = _state.value.copy(
                loading = false,
                rows = rows,
                branches = options.array("branches").map { it.option() },
                customers = options.array("customers").map { it.option() },
                products = options.array("products").map { it.option() },
                services = options.array("services").map { it.option("sellingRate") },
                workPackages = options.array("workPackages").map { it.option("sellingRate") },
                units = options.array("units").map { it.option() }
            )
        } catch (e: Exception) {
            fail(e)
        }
    }

    fun search(query: String) {
        _state.value = _state.value.copy(query = query)
        refresh()
    }

    fun filter(status: String?) {
        _state.value = _state.value.copy(status = status)
        refresh()
    }

    fun create() {
        val current = _state.value
        _state.value = current.copy(
            draft = QuotationDraft(branchId = current.branches.firstOrNull()?.id.orEmpty())
        )
    }

    fun editDraft(draft: QuotationDraft) {
        _state.value = _state.value.copy(draft = draft)
    }

    fun closeDraft() {
        _state.value = _state.value.copy(draft = null)
    }

    fun line(index: Int, line: SalesLineDraft) {
        _state.value.draft?.let {
            editDraft(it.copy(lines = it.lines.mapIndexed { i, current -> if (i == index) line else current }))
        }
    }

    fun addLine() {
        _state.value.draft?.let {
            editDraft(it.copy(lines = it.lines + SalesLineDraft()))
        }
    }

    fun removeLine(index: Int) {
        _state.value.draft?.let {
            if (it.lines.size > 1) {
                editDraft(it.copy(lines = it.lines.filterIndexed { i, _ -> i != index }))
            }
        }
    }

    private fun payload(draft: QuotationDraft) = buildJsonObject {
        put("branchId", draft.branchId)
        put("documentType", draft.documentType)
        put("customerId", draft.customerId)
        put("issueDate", draft.issueDate)
        draft.validUntil.takeIf { it.isNotBlank() }?.let { put("validUntil", it) }
        put("terms", draft.terms)
        put("inclusions", draft.inclusions)
        put("exclusions", draft.exclusions)
        put("notes", draft.notes)
        putJsonArray("lines") {
            draft.lines.forEach { line ->
                add(
                    buildJsonObject {
                        put("lineType", line.lineType)
                        line.sourceId.takeIf { it.isNotBlank() }?.let { put("sourceId", it) }
                        line.itemName.takeIf { it.isNotBlank() }?.let { put("itemName", it) }
                        put("description", line.description)
                        put("quantity", line.quantity)
                        line.rate.takeIf { it.isNotBlank() }?.let { put("rate", it) }
                        line.taxRate.takeIf { it.isNotBlank() }?.let { put("taxRate", it) }
                        line.discountType.takeIf { it.isNotBlank() }?.let {
                            put("discountType", it)
                            put("discountValue", line.discountValue)
                        }
                    }
                )
            }
        }
        putJsonArray("adjustments") {}
        putJsonArray("paymentSchedule") {}
    }

    fun save() {
        val draft = _state.value.draft ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(saving = true)
            try {
                val id = draft.id
                if (id == null) {
                    val created = api.createQuotation(payload(draft))
                    open(created.str("id"))
                } else if (draft.revision) {
                    api.quotationAction(
                        id,
                        buildJsonObject {
                            put("action", "REVISE")
                            put("document", payload(draft))
                        }
                    )
                } else {
                    api.updateQuotation(id, payload(draft))
                }

                _state.value = _state.value.copy(
                    saving = false,
                    draft = null,
                    message = "Quotation saved with server totals."
                )
                refresh()
            } catch (e: Exception) {
                fail(e)
            }
        }
    }

    fun open(id: String) = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true)
        try {
            _state.value = _state.value.copy(loading = false, detail = api.quotation(id))
        } catch (e: Exception) {
            fail(e)
        }
    }

    fun close() {
        _state.value = _state.value.copy(detail = null)
    }

    fun transition(to: String, note: String = "") = viewModelScope.launch {
        val id = _state.value.detail?.str("id") ?: return@launch
        try {
            api.quotationAction(
                id,
                buildJsonObject {
                    put("action", "TRANSITION")
                    put("to", to)
                    put("note", note)
                }
            )
            _state.value = _state.value.copy(
                detail = api.quotation(id),
                message = "Quotation moved to ${to.replace('_', ' ')}."
            )
            refresh()
        } catch (e: Exception) {
            fail(e)
        }
    }

    fun revise() {
        val detail = _state.value.detail ?: return
        val revision = detail.array("revisions").firstOrNull() ?: return
        _state.value = _state.value.copy(
            draft = QuotationDraft(
                id = detail.str("id"),
                revision = detail.str("status") != "DRAFT",
                branchId = detail.str("branchId"),
                customerId = detail.str("customerId"),
                documentType = detail.str("documentType"),
                issueDate = revision.str("issueDate").take(10),
                validUntil = revision.str("validUntil").take(10),
                terms = revision.str("terms"),
                inclusions = revision.str("inclusions"),
                exclusions = revision.str("exclusions"),
                notes = revision.str("notes"),
                lines = revision.array("lines").map {
                    SalesLineDraft(
                        it.str("lineType"),
                        it.str("productId").ifBlank {
                            it.str("serviceId").ifBlank { it.str("workPackageId") }
                        },
                        it.str("itemName"),
                        it.str("description"),
                        it.str("quantity"),
                        it.str("rate"),
                        it.str("discountType"),
                        it.str("discountValue"),
                        it.str("taxRate")
                    )
                }
            )
        )
    }

    fun share() = viewModelScope.launch {
        val id = _state.value.detail?.str("id") ?: return@launch
        try {
            val response = api.quotationAction(
                id,
                buildJsonObject { put("action", "SHARE") }
            ).jsonObject
            _state.value = _state.value.copy(shareToken = response.str("token"))
        } catch (e: Exception) {
            fail(e)
        }
    }

    fun download() = viewModelScope.launch {
        val id = _state.value.detail?.str("id") ?: return@launch
        try {
            _state.value = _state.value.copy(pdf = api.quotationPdf(id))
        } catch (e: Exception) {
            fail(e)
        }
    }

    fun consumedPdf() {
        _state.value = _state.value.copy(pdf = null)
    }

    private fun fail(e: Exception) {
        _state.value = _state.value.copy(
            loading = false,
            saving = false,
            error = when {
                e is IOException -> "You're offline. No quotation change was confirmed."
                e is ApiException && e.status == 403 -> "You are not authorized for this quotation action."
                else -> "The server rejected this quotation action."
            }
        )
    }
}
