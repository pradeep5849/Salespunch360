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

data class PayableBill(
    val id: String,
    val branchId: String,
    val vendorId: String,
    val number: String,
    val outstanding: String
)

data class VendorPaymentRow(
    val id: String,
    val number: String,
    val date: String,
    val amount: String,
    val mode: String
)

data class VendorPaymentState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val branches: List<SalesOption> = emptyList(),
    val vendors: List<SalesOption> = emptyList(),
    val accounts: List<SalesOption> = emptyList(),
    val bills: List<PayableBill> = emptyList(),
    val history: List<VendorPaymentRow> = emptyList(),
    val branchId: String = "",
    val vendorId: String = "",
    val billId: String = "",
    val amount: String = "",
    val date: String = java.time.LocalDate.now().toString(),
    val mode: String = "BANK",
    val accountId: String = "",
    val reference: String = "",
    val notes: String = "",
    val error: String? = null,
    val message: String? = null
)

class VendorPaymentViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient(SecureSession(app))
    private val _state = MutableStateFlow(VendorPaymentState())
    val state: StateFlow<VendorPaymentState> = _state

    init {
        refresh()
    }

    fun update(transform: (VendorPaymentState) -> VendorPaymentState) {
        _state.value = transform(_state.value)
    }

    fun refresh() = viewModelScope.launch {
        update { it.copy(loading = true, error = null) }
        try {
            val context = api.vendorPaymentContext()
            val branches = context.array("branches").map { it.option() }
            update {
                it.copy(
                    loading = false,
                    branches = branches,
                    vendors = context.array("vendors").map { vendor -> vendor.option() },
                    accounts = context.array("moneyAccounts").map { account -> account.option() },
                    bills = context.array("documents").map { bill ->
                        PayableBill(
                            bill.str("id"),
                            bill.str("branchId"),
                            bill.str("vendorId"),
                            bill.str("documentNumber"),
                            bill.str("outstanding")
                        )
                    },
                    history = context.array("payments").map { payment ->
                        VendorPaymentRow(
                            payment.str("id"),
                            payment.str("settlementNumber"),
                            payment.str("transactionDate").take(10),
                            payment.str("amount"),
                            payment.str("paymentMode")
                        )
                    },
                    branchId = it.branchId.ifBlank { branches.firstOrNull()?.id.orEmpty() }
                )
            }
        } catch (e: Exception) {
            fail(e)
        }
    }

    fun save() = viewModelScope.launch {
        val current = _state.value
        if (current.amount.toDoubleOrNull()?.let { it > 0 } != true || current.billId.isBlank()) {
            update { it.copy(error = "Select a bill and enter a positive amount.") }
            return@launch
        }

        update { it.copy(saving = true) }
        try {
            api.createVendorPayment(
                buildJsonObject {
                    put("idempotencyKey", UUID.randomUUID().toString())
                    put("type", "VENDOR_PAYMENT")
                    put("branchId", current.branchId)
                    put("partyId", current.vendorId)
                    put("paymentMode", current.mode)
                    current.accountId.takeIf { it.isNotBlank() }?.let { put("moneyAccountId", it) }
                    put("amount", current.amount)
                    put("transactionDate", current.date)
                    put("reference", current.reference)
                    put("notes", current.notes)
                    putJsonArray("allocations") {
                        add(
                            buildJsonObject {
                                put("documentId", current.billId)
                                put("amount", current.amount)
                            }
                        )
                    }
                }
            )
            update {
                it.copy(
                    saving = false,
                    billId = "",
                    amount = "",
                    message = "Vendor payment posted by the server."
                )
            }
            refresh()
        } catch (e: Exception) {
            fail(e)
        }
    }

    private fun fail(e: Exception) {
        update {
            it.copy(
                loading = false,
                saving = false,
                error = if (e is IOException) {
                    "You're offline. The payment was not posted."
                } else {
                    "The server rejected this vendor payment."
                }
            )
        }
    }
}
