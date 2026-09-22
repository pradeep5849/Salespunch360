package com.salespunch360.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.salespunch360.mobile.account.*
import com.salespunch360.mobile.data.*
import java.io.IOException
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

data class ReceiptInvoice(
    val id: String,
    val branchId: String,
    val customerId: String,
    val number: String,
    val outstanding: String
)

data class ReceiptRow(val id: String, val number: String, val date: String, val amount: String, val mode: String)

data class ReceiptState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val customers: List<SalesOption> = emptyList(),
    val branches: List<SalesOption> = emptyList(),
    val moneyAccounts: List<SalesOption> = emptyList(),
    val invoices: List<ReceiptInvoice> = emptyList(),
    val history: List<ReceiptRow> = emptyList(),
    val branchId: String = "",
    val customerId: String = "",
    val invoiceId: String = "",
    val amount: String = "",
    val date: String = java.time.LocalDate.now().toString(),
    val mode: String = "BANK",
    val moneyAccountId: String = "",
    val reference: String = "",
    val notes: String = "",
    val error: String? = null,
    val message: String? = null
)

class CustomerReceiptViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient(SecureSession(app))
    private val _state = MutableStateFlow(ReceiptState())
    val state: StateFlow<ReceiptState> = _state

    init {
        refresh()
    }

    fun refresh() = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, error = null)
        try {
            val context = api.customerReceiptContext()
            val branches = context.array("branches").map { it.option() }
            val customers = context.array("customers").map { it.option() }
            val accounts = context.array("moneyAccounts").map { it.option() }
            val documents = context.array("documents").map {
                ReceiptInvoice(
                    it.str("id"),
                    it.str("branchId"),
                    it.str("customerId"),
                    it.str("documentNumber"),
                    it.str("outstanding")
                )
            }
            val history = context.array("receipts").map {
                ReceiptRow(
                    it.str("id"),
                    it.str("settlementNumber"),
                    it.str("transactionDate").take(10),
                    it.str("amount"),
                    it.str("paymentMode")
                )
            }
            _state.value = _state.value.copy(
                loading = false,
                branches = branches,
                customers = customers,
                moneyAccounts = accounts,
                invoices = documents,
                history = history,
                branchId = _state.value.branchId.ifBlank { branches.firstOrNull()?.id.orEmpty() }
            )
        } catch (e: Exception) {
            _state.value = _state.value.copy(loading = false, error = errorText(e))
        }
    }

    fun update(transform: (ReceiptState) -> ReceiptState) {
        _state.value = transform(_state.value)
    }

    fun save() = viewModelScope.launch {
        val current = _state.value
        val parsedAmount = current.amount.toDoubleOrNull()
        if (parsedAmount == null || parsedAmount <= 0 || current.invoiceId.isBlank()) {
            _state.value = current.copy(error = "Select an invoice and enter a positive amount.")
            return@launch
        }
        _state.value = current.copy(saving = true, error = null)
        try {
            api.createCustomerReceipt(
                buildJsonObject {
                    put("idempotencyKey", UUID.randomUUID().toString())
                    put("type", "CUSTOMER_RECEIPT")
                    put("branchId", current.branchId)
                    put("partyId", current.customerId)
                    put("paymentMode", current.mode)
                    current.moneyAccountId.takeIf { it.isNotBlank() }?.let { put("moneyAccountId", it) }
                    put("amount", current.amount)
                    put("transactionDate", current.date)
                    put("reference", current.reference)
                    put("notes", current.notes)
                    putJsonArray("allocations") {
                        add(buildJsonObject {
                            put("documentId", current.invoiceId)
                            put("amount", current.amount)
                        })
                    }
                }
            )
            _state.value = current.copy(
                saving = false,
                amount = "",
                invoiceId = "",
                message = "Customer receipt posted by the server."
            )
            refresh()
        } catch (e: Exception) {
            _state.value = current.copy(saving = false, error = errorText(e))
        }
    }

    private fun errorText(e: Exception) = when {
        e is IOException -> "You're offline. The receipt was not posted."
        e is ApiException && e.status == 403 -> "You are not authorized to receive this payment."
        else -> "The server rejected this receipt or allocation."
    }
}
