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
    val type: String,
    val number: String,
    val date: String,
    val amount: String,
    val mode: String
)

data class VendorOpening(val id:String,val branchId:String,val vendorId:String,val outstanding:String,val date:String)

data class VendorPaymentState(
    val requestKey:String=UUID.randomUUID().toString(),
    val type:String="VENDOR_PAYMENT",
    val allowedTypes:List<String> = emptyList(),
    val openings:List<VendorOpening> = emptyList(),
    val openingId:String="",
    val linkAmount:String="",
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
    val date: String = com.salespunch360.mobile.account.accountReportToday().toString(),
    val mode: String = "BANK",
    val accountId: String = "",
    val reference: String = "",
    val notes: String = "",
    val error: String? = null,
    val message: String? = null
)

class VendorPaymentViewModel(app: Application) : AndroidViewModel(app) {
    private var initialBranchApplied=false
    private val api = ApiClient(SecureSession(app))
    private val _state = MutableStateFlow(VendorPaymentState())
    val state: StateFlow<VendorPaymentState> = _state

    init {
        refresh()
    }

    fun update(transform: (VendorPaymentState) -> VendorPaymentState) {
        if(!_state.value.saving)_state.value = transform(_state.value)
    }

    fun refresh() = viewModelScope.launch {
        update { it.copy(loading = true, error = null) }
        try {
            val context = api.vendorPaymentContext()
            val branches = context.array("branches").map { it.option() }
            update {
                it.copy(
                    loading = false,
                    allowedTypes=(context["allowedTypes"] as? JsonArray)?.map{it.jsonPrimitive.content}.orEmpty(),
                    openings=context.array("openings").map{row->VendorOpening(row.str("id"),row.str("branchId"),row.str("partyId"),row.str("outstanding"),row.str("effectiveDate"))},
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
                            payment.str("type").ifBlank { "VENDOR_PAYMENT" },
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

    fun initialBranch(branch:String?){if(initialBranchApplied)return;initialBranchApplied=true;if(branch!=null&&_state.value.branchId!=branch&&_state.value.branches.any{it.id==branch})update{it.copy(branchId=branch,vendorId="",billId="",openingId="")}}

    fun save() = viewModelScope.launch {
        val current = _state.value
        if(current.saving||current.loading)return@launch
        if (current.type !in current.allowedTypes || current.amount.toBigDecimalOrNull()?.let { it.signum()>0 && it.scale()<=2 } != true || current.vendorId.isBlank() || (current.type!="VENDOR_ADVANCE" && current.billId.isBlank() && current.openingId.isBlank())) {
            update { it.copy(error = "Select an available payment type, vendor and target, and enter a positive amount with up to two decimals.") }
            return@launch
        }

        update { it.copy(saving = true) }
        try {
            api.createVendorPayment(
                buildJsonObject {
                    put("idempotencyKey", current.requestKey)
                    put("type", current.type)
                    put("branchId", current.branchId)
                    put("partyId", current.vendorId)
                    put("paymentMode", current.mode)
                    current.accountId.takeIf { it.isNotBlank() }?.let { put("moneyAccountId", it) }
                    put("amount", current.amount)
                    put("transactionDate", current.date)
                    put("reference", current.reference)
                    put("notes", current.notes)
                    putJsonArray("allocations") {
                        if(current.type!="VENDOR_ADVANCE")add(
                            buildJsonObject {
                                if(current.openingId.isNotBlank())put("openingBalanceId",current.openingId) else put("documentId", current.billId)
                                put("amount", current.linkAmount.ifBlank{current.amount})
                            }
                        )
                    }
                }
            )
            update {
                it.copy(
                    saving = false,
                    requestKey=UUID.randomUUID().toString(),
                    openingId="",linkAmount="",
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
                    "Connection interrupted. Your inputs and request reference were kept. Retry the same payment when online."
                } else {
                    (e as? ApiException)?.serverMessage ?: "The server rejected this vendor payment."
                }
            )
        }
    }
}
