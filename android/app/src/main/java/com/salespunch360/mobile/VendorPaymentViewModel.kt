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
    val multipleLinks:Boolean=false,
    val links:Map<String,String> = emptyMap(),
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
    val chequeNumber:String="",
    val chequeDate:String=com.salespunch360.mobile.account.accountReportToday().toString(),
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
        _state.value = transform(_state.value)
    }

    fun edit(transform:(VendorPaymentState)->VendorPaymentState){if(_state.value.saving||_state.value.loading)return;val old=_state.value;val next=transform(old);val changed=old.vendorId!=next.vendorId||old.branchId!=next.branchId||old.type!=next.type;_state.value=next.copy(links=if(changed)emptyMap()else next.links,error=null,message=null)}

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

    private var duplicateApplied:String?=null
    fun duplicate(id:String?){if(id==null||_state.value.loading||duplicateApplied==id)return;duplicateApplied=id;update{it.copy(loading=true)};viewModelScope.launch{try{val draft=api.accountSettlement(id,true);val s=_state.value;require(draft.str("type") in s.allowedTypes&&s.branches.any{it.id==draft.str("branchId")}&&s.vendors.any{it.id==draft.str("partyId")}){"This duplicate is unavailable in your current context."};update{it.copy(loading=false,type=draft.str("type"),branchId=draft.str("branchId"),vendorId=draft.str("partyId"),billId="",openingId="",multipleLinks=true,links=emptyMap(),amount=draft.str("amount"),mode=draft.str("paymentMode"),accountId=draft.str("moneyAccountId"),notes=draft.str("notes"),reference="",linkAmount="",date=com.salespunch360.mobile.account.accountReportToday().toString(),requestKey=UUID.randomUUID().toString(),message="Independent unlinked payment prepared. Review it before posting.")}}catch(e:Exception){fail(e)}}}

    fun save() = viewModelScope.launch {
        val current = _state.value
        if(current.saving||current.loading)return@launch
        val validation=vendorPaymentValidation(current)
        if(validation!=null){update{it.copy(error=validation)};return@launch}

        update { it.copy(saving = true) }
        try {
            api.createVendorPayment(vendorPaymentPayload(current))
            update {
                it.copy(
                    saving = false,
                    requestKey=UUID.randomUUID().toString(),
                    openingId="",linkAmount="",links=emptyMap(),
                    billId = "",
                    amount = "",
                    chequeNumber="",
                    message = if(current.mode=="CHEQUE")"Cheque saved as pending; it posts only when cleared."else "Vendor payment posted by the server."
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

internal fun vendorPaymentValidation(s:VendorPaymentState):String? {
 val amount=s.amount.toBigDecimalOrNull()
 if(s.type !in s.allowedTypes||s.vendorId.isBlank()||s.branchId.isBlank())return "Select an available payment type, branch and vendor."
 if(!Regex("\\d{1,16}(\\.\\d{1,2})?").matches(s.amount)||amount==null||amount.signum()<=0)return "Enter a positive amount with up to two decimals."
 if(runCatching{java.time.LocalDate.parse(s.date)}.isFailure)return "Enter a real payment date."
 if(s.mode=="CHEQUE"&&(s.chequeNumber.isBlank()||s.accountId.isBlank()||runCatching{java.time.LocalDate.parse(s.chequeDate)}.isFailure))return "Enter a cheque number, real cheque date and bank account."
 if(s.type=="VENDOR_ADVANCE")return null
 if(s.multipleLinks){var total=java.math.BigDecimal.ZERO;for((id,text) in s.links){if(text.isBlank())continue
  val bill=s.bills.find{it.id==id&&it.branchId==s.branchId&&it.vendorId==s.vendorId}?:return "A bill is outside this vendor and branch."
  val link=text.toBigDecimalOrNull()
  if(!Regex("\\d{1,16}(\\.\\d{1,2})?").matches(text)||link==null||link.signum()<=0||link>(bill.outstanding.toBigDecimalOrNull()?:java.math.BigDecimal.ZERO))return "Enter positive link amounts within each bill balance."
  total+=link
 };if(total>amount)return "Linked amounts exceed the payment.";return null}
 if(s.billId.isBlank()&&s.openingId.isBlank())return "Select a bill or opening balance."
 return null
}
internal fun vendorPaymentPayload(current:VendorPaymentState)=buildJsonObject {
 if(current.mode=="CHEQUE"){put("chequeNumber",current.chequeNumber);put("chequeDate",current.chequeDate)}
 put("idempotencyKey",current.requestKey);put("type",current.type);put("branchId",current.branchId);put("partyId",current.vendorId);put("paymentMode",current.mode)
 current.accountId.takeIf{it.isNotBlank()}?.let{put("moneyAccountId",it)};put("amount",current.amount);put("transactionDate",current.date);put("reference",current.reference);put("notes",current.notes)
 putJsonArray("allocations"){if(current.type!="VENDOR_ADVANCE"){if(current.multipleLinks)current.links.filterValues{it.isNotBlank()}.forEach{(id,amount)->add(buildJsonObject{put("documentId",id);put("amount",amount)})}else add(buildJsonObject{if(current.openingId.isNotBlank())put("openingBalanceId",current.openingId)else put("documentId",current.billId);put("amount",current.linkAmount.ifBlank{current.amount})})}}
}
