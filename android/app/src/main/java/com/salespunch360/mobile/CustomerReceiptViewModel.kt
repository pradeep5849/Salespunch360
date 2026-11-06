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
    val projectId: String,
    val number: String,
    val outstanding: String
)

data class ReceiptRow(val id: String, val number: String, val date: String, val amount: String, val mode: String,val type:String="CUSTOMER_RECEIPT")

data class ReceiptAdvance(val id:String,val number:String,val branchId:String,val customerId:String,val projectId:String,val remaining:String)
data class ReceiptState(
    val multipleLinks:Boolean=false,
    val links:Map<String,String> = emptyMap(),
    val type:String="CUSTOMER_RECEIPT",
    val allowedTypes:List<String> = emptyList(),
    val advances:List<ReceiptAdvance> = emptyList(),
    val advanceId:String="",
    val projectCustomers:Map<String,String> = emptyMap(),
    val requestKey:String=UUID.randomUUID().toString(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val customers: List<SalesOption> = emptyList(),
    val branches: List<SalesOption> = emptyList(),
    val moneyAccounts: List<SalesOption> = emptyList(),
    val projects: List<SalesOption> = emptyList(),
    val invoices: List<ReceiptInvoice> = emptyList(),
    val history: List<ReceiptRow> = emptyList(),
    val branchId: String = "",
    val customerId: String = "",
    val projectId: String = "",
    val invoiceId: String = "",
    val amount: String = "",
    val discountAmount:String="",
    val discountEnabled:Boolean=false,
    val date: String = com.salespunch360.mobile.account.accountReportToday().toString(),
    val chequeNumber:String="",
    val chequeDate:String=com.salespunch360.mobile.account.accountReportToday().toString(),
    val evidenceFiles:List<SaleCreationAttachment> = emptyList(),
    val billingName:String="",
    val billingAddress:String="",
    val mode: String = "BANK",
    val moneyAccountId: String = "",
    val reference: String = "",
    val notes: String = "",
    val error: String? = null,
    val message: String? = null
)

class CustomerReceiptViewModel(app: Application) : AndroidViewModel(app) {
    private var initialRouteApplied=false
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
            val projects = context.array("projects").map { it.option() }
            val documents = context.array("documents").map {
                ReceiptInvoice(
                    it.str("id"),
                    it.str("branchId"),
                    it.str("customerId"),
                    it.str("projectId"),
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
                    it.str("paymentMode"),
                    it.str("type").ifBlank{"CUSTOMER_RECEIPT"}
                )
            }
            _state.value = _state.value.copy(
                loading = false,
                discountEnabled=context["discountDuringPayment"]?.jsonPrimitive?.booleanOrNull==true,
                branches = branches,
                customers = customers,
                moneyAccounts = accounts,
                projects = projects,
                projectCustomers=context.array("projects").associate{it.str("id") to it.str("customerId")},
                advances=context.array("advances").map{ReceiptAdvance(it.str("id"),it.str("settlementNumber"),it.str("branchId"),it.str("customerId"),it.str("projectId"),it.str("remainingAmount"))},
                allowedTypes=(context["allowedTypes"] as? JsonArray)?.map{it.jsonPrimitive.content}.orEmpty(),
                invoices = documents,
                history = history,
                branchId = _state.value.branchId.ifBlank { branches.firstOrNull()?.id.orEmpty() }
            )
        } catch (e: Exception) {
            _state.value = _state.value.copy(loading = false, error = errorText(e))
        }
    }

    fun initialRoute(projectId:String?,requestedType:String?,branchId:String?=null){
        val s=_state.value;if(s.loading||initialRouteApplied)return;initialRouteApplied=true
        val project=s.projects.find{it.id==projectId}
        _state.value=s.copy(type=requestedType?.takeIf{it in s.allowedTypes}?:s.type.takeIf{it in s.allowedTypes}?:s.allowedTypes.firstOrNull().orEmpty(),projectId=project?.id.orEmpty(),branchId=project?.branchId?:s.branches.find{it.id==branchId}?.id?:s.branchId,customerId=project?.let{s.projectCustomers[it.id]}.orEmpty())
    }
    private var duplicateApplied:String?=null
    fun duplicate(id:String?){if(id==null||_state.value.loading||duplicateApplied==id)return;duplicateApplied=id;_state.value=_state.value.copy(loading=true);viewModelScope.launch{try{val draft=api.accountSettlement(id,true);val s=_state.value;require(draft.str("type") in s.allowedTypes&&s.branches.any{it.id==draft.str("branchId")}&&s.customers.any{it.id==draft.str("partyId")}){"This duplicate is unavailable in your current context."};_state.value=s.copy(loading=false,type=draft.str("type"),branchId=draft.str("branchId"),customerId=draft.str("partyId"),projectId="",invoiceId="",advanceId="",multipleLinks=true,links=emptyMap(),amount=draft.str("amount"),mode=draft.str("paymentMode"),moneyAccountId=draft.str("moneyAccountId"),notes=draft.str("notes"),reference="",discountAmount="",date=com.salespunch360.mobile.account.accountReportToday().toString(),requestKey=UUID.randomUUID().toString(),message="Independent unlinked payment prepared. Review it before posting.")}catch(e:Exception){_state.value=_state.value.copy(loading=false,error=errorText(e))}}}
    fun update(transform: (ReceiptState) -> ReceiptState) {
        if(_state.value.saving||_state.value.loading)return
        val previous=_state.value
        val next=transform(previous)
        val changedContext=next.branchId!=previous.branchId||next.customerId!=previous.customerId||next.projectId!=previous.projectId||next.type!=previous.type
        _state.value=next.copy(links=if(changedContext)emptyMap()else next.links,requestKey=UUID.randomUUID().toString(),error=null,message=null)
    }

    fun save() {
        val current = _state.value
        if(current.saving||current.loading)return
        val error=receiptValidation(current)
        if(error!=null){_state.value=current.copy(error=error);return}
        _state.value=current.copy(saving=true,error=null)
        viewModelScope.launch {
            try {
                if(current.type!="APPLY_ADVANCE"&&current.evidenceFiles.isNotEmpty())api.createPaymentWithAttachments(receiptPayload(current),current.evidenceFiles)else api.createCustomerReceipt(receiptPayload(current))
                _state.value = current.copy(saving=false,amount="",discountAmount="",invoiceId="",advanceId="",links=emptyMap(),requestKey=UUID.randomUUID().toString(),evidenceFiles=emptyList(),billingName="",billingAddress="",chequeNumber="",message=if(current.type!="APPLY_ADVANCE"&&current.mode=="CHEQUE")"Cheque saved as pending; it posts only when cleared."else if(current.type=="APPLY_ADVANCE")"Advance applied by the server." else "Customer payment posted by the server.")
                refresh()
            } catch(e:Exception){_state.value=current.copy(saving=false,error=errorText(e))}
        }
    }

    private fun errorText(e: Exception) = when {
        e is IOException -> "Connection interrupted. Your inputs and request reference were kept; retry when online."
        e is ApiException && e.status == 403 -> "You are not authorized to receive this payment."
        e is ApiException -> e.serverMessage ?: "The server rejected this payment or advance allocation."
        else -> "The server rejected this receipt or allocation."
    }
}

internal fun receiptValidation(s:ReceiptState):String? {
 if(s.type!="APPLY_ADVANCE"&&s.mode=="CHEQUE"&&(s.chequeNumber.isBlank()||s.moneyAccountId.isBlank()||runCatching{java.time.LocalDate.parse(s.chequeDate)}.isFailure))return "Enter a cheque number, real cheque date and bank account."
 if(s.type !in s.allowedTypes)return "This payment function is disabled."
 val amount=s.amount.toBigDecimalOrNull()
 if(!Regex("\\d{1,16}(\\.\\d{1,2})?").matches(s.amount)||amount==null||amount.signum()<=0)return "Enter a positive amount with up to two decimal places."
 if(runCatching{java.time.LocalDate.parse(s.date)}.isFailure)return "Enter a valid date in YYYY-MM-DD format."
 if(s.branchId.isBlank()||s.customerId.isBlank())return "Select a branch and customer."
 val discount=if(s.type=="CUSTOMER_RECEIPT"&&s.discountEnabled)s.discountAmount.ifBlank{"0"}.toBigDecimalOrNull() else java.math.BigDecimal.ZERO
 if(discount==null||discount.signum()<0||discount.scale()>2||(s.type=="CUSTOMER_RECEIPT"&&s.discountEnabled&&!Regex("\\d{1,16}(\\.\\d{1,2})?").matches(s.discountAmount.ifBlank{"0"})))return "Enter a payment discount with up to two decimal places."
 if(s.type=="CUSTOMER_RECEIPT"&&s.multipleLinks){
  if(discount.signum()!=0)return "Use single-invoice mode for a payment discount."
  var total=java.math.BigDecimal.ZERO
  for((id,text) in s.links){if(text.isBlank())continue
   val link=text.toBigDecimalOrNull()
   val invoice=s.invoices.find{it.id==id&&it.branchId==s.branchId&&it.customerId==s.customerId&&it.projectId==s.projectId}?:return "An invoice is outside this payment context."
   if(!Regex("\\d{1,16}(\\.\\d{1,2})?").matches(text)||link==null||link.signum()<=0||link>(invoice.outstanding.toBigDecimalOrNull()?:java.math.BigDecimal.ZERO))return "Enter a positive link amount within each invoice balance."
   total+=link
  }
  if(total>amount)return "Linked amounts exceed cash received."
 }else if(s.type!="CUSTOMER_ADVANCE"){
  val invoice=s.invoices.find{it.id==s.invoiceId&&it.branchId==s.branchId&&it.customerId==s.customerId&&it.projectId==s.projectId}?:return "Select an invoice for this customer, branch and Project."
  if(amount+discount>(invoice.outstanding.toBigDecimalOrNull()?:java.math.BigDecimal.ZERO))return "Cash plus discount exceeds the invoice balance."
 }
 if(s.type=="APPLY_ADVANCE"){
  val advance=s.advances.find{it.id==s.advanceId&&it.branchId==s.branchId&&it.customerId==s.customerId&&it.projectId==s.projectId}?:return "Select an advance for this invoice's customer and Project."
  if(amount>(advance.remaining.toBigDecimalOrNull()?:java.math.BigDecimal.ZERO))return "Amount exceeds the unused advance."
 }
 return null
}
internal fun receiptPayload(s:ReceiptState)=if(s.type=="APPLY_ADVANCE")buildJsonObject{
 put("action","APPLY_ADVANCE");putJsonObject("payload"){put("advanceId",s.advanceId);put("documentId",s.invoiceId);put("amount",s.amount);put("applicationDate",s.date);put("idempotencyKey",s.requestKey)}
}else buildJsonObject{
 if(s.mode=="CHEQUE"){put("chequeNumber",s.chequeNumber);put("chequeDate",s.chequeDate)}
 put("billingName",s.billingName);put("billingAddress",s.billingAddress)
 put("idempotencyKey",s.requestKey);put("type",s.type);put("branchId",s.branchId);put("partyId",s.customerId);s.projectId.takeIf{it.isNotBlank()}?.let{put("projectId",it)};put("paymentMode",s.mode);s.moneyAccountId.takeIf{it.isNotBlank()}?.let{put("moneyAccountId",it)};put("amount",s.amount);put("transactionDate",s.date);put("reference",s.reference);put("notes",s.notes);putJsonArray("allocations"){if(s.type=="CUSTOMER_RECEIPT"&&s.multipleLinks){s.links.filterValues{it.isNotBlank()}.forEach{(id,amount)->add(buildJsonObject{put("documentId",id);put("amount",amount)})}}else if(s.type=="CUSTOMER_RECEIPT")add(buildJsonObject{put("documentId",s.invoiceId);val discount=if(s.discountEnabled)s.discountAmount.ifBlank{"0"}.toBigDecimalOrNull()?:java.math.BigDecimal.ZERO else java.math.BigDecimal.ZERO;put("amount",((s.amount.toBigDecimalOrNull()?:java.math.BigDecimal.ZERO)+discount).toPlainString());put("discountAmount",discount.toPlainString())})}
}
