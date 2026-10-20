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
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.serialization.json.*

data class QuotationDraft(val billingName:String="",val taxMode:String="EXCLUSIVE",val stateOfSupplyCode:String="",val roundOffEnabled:Boolean=false,
    val customFields:Map<String,String> = emptyMap(),
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
    val lines: List<SalesLineDraft> = listOf(SalesLineDraft()),
    val lineMetadata: List<JsonObject> = emptyList(),
    val adjustments: List<JsonObject> = emptyList(),
    val paymentSchedule: List<JsonObject> = emptyList(),
    val creationRequestKey: String = java.util.UUID.randomUUID().toString()
)

data class QuotationRow(
    val id: String,
    val number: String,
    val type: String,
    val customer: String,
    val status: String,
    val total: String,
    val revision: Int,
    val issueDate:String=""
)

data class QuotationState(
    val creationAttachments:List<QuotationCreationAttachment> = emptyList(),
    val companyName:String="",
    val stateOfSupplyOptions:List<Pair<String,String>> = emptyList(),
    val canCreate:Boolean=false,
    val canCreateParty:Boolean=false,
    val canCreateItem:Boolean=false,
    val canCost:Boolean=false,
    val itemReturnPending:Boolean=false,
    val itemReturnError:String?=null,
    val canViewPartyBalance:Boolean=false,
    val partyBalance:JsonObject?=null,
    val stockAvailable:Boolean=false,
    val stockPositions:List<JsonObject> = emptyList(),
    val customFields:List<JsonObject> = emptyList(),
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
    val message: String? = null,
    val preview: Boolean = false,
    val pdfPreview:Boolean=false
)

class QuotationViewModel(app: Application) : AndroidViewModel(app) {
    private var partyBalanceJob:Job?=null
    private var itemReturnJob:Job?=null

    private val api = ApiClient(SecureSession(app))
    private val _state = MutableStateFlow(QuotationState())
    val state: StateFlow<QuotationState> = _state

    private var detailTarget:String?=null
    private var listJob:Job?=null

    init {
        refresh()
    }

    fun refresh(){loadList(0)}
    private fun loadList(waitMillis:Long){listJob?.cancel();val query=_state.value.query;val status=_state.value.status;listJob=viewModelScope.launch {
        if(waitMillis>0)delay(waitMillis)
        _state.value = _state.value.copy(loading = true, error = null)
        try {
            val options = api.quotationOptions()
            val rows = api.quotations(query, status)
                .map { it.jsonObject }
                .map {
                    val revision = it.array("revisions").firstOrNull()
                    QuotationRow(
                        it.str("id"),
                        it.str("documentNumber"),
                        it.str("documentType"),
                        revision?.str("customerName").orEmpty(),
                        quotationDisplayStatus(it),
                        revision?.str("grandTotal").orEmpty(),
                        it.str("currentRevisionNumber").toIntOrNull() ?: 0,
                        revision?.str("issueDate").orEmpty()
                    )
                }

            currentCoroutineContext().ensureActive()
            _state.value = _state.value.copy(
                companyName=options.str("companyName"),
                stateOfSupplyOptions=options.array("stateOfSupplyOptions").map{it.str("code") to it.str("name")},
                canCost=options["canCost"]?.jsonPrimitive?.booleanOrNull==true,
                canCreateParty=options["partyCreation"] is JsonObject,
                canCreateItem=options["canCreateItem"]?.jsonPrimitive?.booleanOrNull==true,
                canViewPartyBalance=options["canViewPartyBalance"]?.jsonPrimitive?.booleanOrNull==true,
                stockAvailable=options["stock"] is JsonObject,
                stockPositions=(options["stock"] as? JsonObject)?.array("positions").orEmpty(),
                canCreate=options["canCreate"]?.jsonPrimitive?.booleanOrNull==true,
                loading = false,
                rows = rows,
                customFields=options.array("customFields"),
                branches = options.array("branches").map { it.option() },
                customers = options.array("customers").map { it.option() },
                products = options.array("products").map { it.option() },
                services = options.array("services").map { it.option("sellingRate").copy(costPrice=it.str("estimatedCost").ifBlank{null}) },
                workPackages = options.array("workPackages").map { it.option("sellingRate") },
                units = options.array("units").map { it.option() }
            )
        } catch(e:CancellationException){throw e} catch (e: Exception) {
            fail(e)
        }
    }}

    fun search(query: String) {
        _state.value = _state.value.copy(query = query)
        loadList(250)
    }

    fun filter(status: String?) {
        _state.value = _state.value.copy(status = status)
        refresh()
    }

    fun createEstimate(){if(!_state.value.canCreate||_state.value.saving)return;val current=_state.value;_state.value=current.copy(creationAttachments=emptyList(),draft=QuotationDraft(branchId=current.branches.firstOrNull()?.id.orEmpty(),documentType="ESTIMATE"))}

    fun create() {
        val current = _state.value
        _state.value = current.copy(
            creationAttachments=emptyList(),
            draft = QuotationDraft(branchId = current.branches.firstOrNull()?.id.orEmpty())
        )
    }

    fun editDraft(draft: QuotationDraft) {
        if(_state.value.saving)return
        val previous=_state.value.draft
        _state.value = _state.value.copy(draft = previous?.let{editedQuotationDraft(it,draft)}?:draft)
    }

    fun selectCreatedParty(record:AccountMasterRecord){
        val current=_state.value;val draft=current.draft?:return
        val selected=if(current.canCreateParty)quotationWithCreatedParty(draft,record)else null
        if(selected==null){_state.value=current.copy(error="The party was saved but cannot be selected for this estimate branch. Your estimate draft was retained.");return}
        val option=SalesOption(id=record.id,name=record.name,branchId=record.branchId,phone=record.phone)
        _state.value=current.copy(draft=selected,customers=current.customers.filterNot{it.id==record.id}+option,error=null)
    }

    fun selectCreatedItem(index:Int,id:String,kind:String,done:()->Unit){
        if(itemReturnJob?.isActive==true)return
        val expected=_state.value.draft?:return
        _state.value=_state.value.copy(itemReturnPending=true,itemReturnError=null)
        itemReturnJob=viewModelScope.launch{
            try{
                val options=api.quotationOptions();currentCoroutineContext().ensureActive()
                val current=_state.value;val draft=current.draft
                if(draft==null||draft.creationRequestKey!=expected.creationRequestKey||draft.branchId!=expected.branchId)throw IllegalStateException("Draft changed")
                val selected=quotationWithCreatedItem(draft,index,id,kind,options)?:throw IllegalStateException("Item unavailable")
                _state.value=current.copy(draft=selected,itemReturnPending=false,itemReturnError=null,
                    products=options.array("products").map{it.option()},services=options.array("services").map{it.option("sellingRate").copy(costPrice=it.str("estimatedCost").ifBlank{null})},units=options.array("units").map{it.option()},
                    stockAvailable=options["stock"] is JsonObject,stockPositions=(options["stock"] as? JsonObject)?.array("positions").orEmpty())
                done()
            }catch(e:CancellationException){throw e}catch(_:Exception){_state.value=_state.value.copy(itemReturnPending=false,itemReturnError="Item saved. Returning failed. Retry; the item will not be created again.")}
        }
    }

    fun loadPartyBalance(partyId:String,branchId:String){
        partyBalanceJob?.cancel()
        fun pending(error:Boolean=false)=buildJsonObject{put("partyId",partyId);put("branchId",branchId);put(if(error)"error"else "loading",true)}
        if(!_state.value.canViewPartyBalance||partyId.isBlank()||branchId.isBlank()){_state.value=_state.value.copy(partyBalance=null);return}
        _state.value=_state.value.copy(partyBalance=pending())
        partyBalanceJob=viewModelScope.launch{
            try{
                val response=api.quotationPartyBalance(partyId,branchId);currentCoroutineContext().ensureActive()
                val current=_state.value;val draft=current.draft
                if(draft?.customerId==partyId&&draft.branchId==branchId&&current.canViewPartyBalance){
                    val amount=quotationBalanceForDraft(draft,response)
                    _state.value=current.copy(partyBalance=if(amount==null)pending(true)else response)
                }
            }catch(error:CancellationException){throw error}catch(_:Exception){
                val current=_state.value;if(current.draft?.customerId==partyId&&current.draft.branchId==branchId&&current.canViewPartyBalance)_state.value=current.copy(partyBalance=pending(true))
            }
        }
    }

    fun closeDraft() {
        if(_state.value.saving)return
        partyBalanceJob?.cancel()
        itemReturnJob?.cancel()
        _state.value = _state.value.copy(creationAttachments=emptyList(),draft = null,partyBalance=null,itemReturnPending=false,itemReturnError=null)
    }

    fun addCreationAttachment(file:QuotationCreationAttachment,creationKey:String){
        val current=_state.value;if(current.saving||current.draft==null||current.draft.id!=null||current.draft.creationRequestKey!=creationKey)return
        val files=current.creationAttachments+file
        require(validQuotationCreationAttachments(files)){"Choose PDF, PNG or JPEG files, up to 50 files and 10 MB combined."}
        _state.value=current.copy(creationAttachments=files)
    }
    fun removeCreationAttachment(index:Int){if(!_state.value.saving)_state.value=_state.value.copy(creationAttachments=_state.value.creationAttachments.filterIndexed{position,_->position!=index})}

    fun line(index: Int, line: SalesLineDraft) {
        _state.value.draft?.let { editDraft(editedQuotationLine(it, index, line)) }
    }

    fun addLine() {
        _state.value.draft?.let {
            editDraft(it.copy(lines = it.lines + SalesLineDraft(), lineMetadata = it.lines.indices.map { i -> it.lineMetadata.getOrNull(i) ?: JsonObject(emptyMap()) } + JsonObject(emptyMap())))
        }
    }

    fun removeLine(index: Int) {
        _state.value.draft?.let { editDraft(removedQuotationLine(it, index)) }
    }

    private fun payload(draft: QuotationDraft) = quotationDraftPayload(draft)

    fun save() = saveDraft(false)
    fun saveAndNew() = saveDraft(true)

    private fun saveDraft(startNew: Boolean) {
        if(_state.value.saving)return
        val draft = _state.value.draft ?: return
        val attachments=_state.value.creationAttachments.toList()
        if(startNew && draft.id != null)return
        _state.value = _state.value.copy(saving = true,error=null)
        viewModelScope.launch {
            try {
                val id = draft.id
                val savedId = if (id == null) {
                    (if(attachments.isEmpty())api.createQuotation(payload(draft))else api.createQuotationWithAttachments(payload(draft),attachments)).str("id")
                } else {
                    if(draft.revision)api.quotationAction(id,buildJsonObject { put("action","REVISE");put("document",payload(draft)) })
                    else api.updateQuotation(id,payload(draft))
                    id
                }
                // The write is confirmed. A failed detail reload must never retain
                // this form as an unsaved revision that could be submitted again.
                _state.value = _state.value.copy(creationAttachments=emptyList(),saving=false,draft=if(startNew) freshQuotationAfterSave(draft) else null,detail=null,preview=false,message="Quotation saved with server totals.")
                if(!startNew) openDetail(savedId, draft.id == null)
                refresh()
            } catch(e:Exception) { fail(e) }
        }
    }

    fun open(id:String) = openDetail(id, false)
    private fun openDetail(id:String, preview:Boolean) {
        detailTarget=id
        _state.value=_state.value.copy(preview=preview)
        viewModelScope.launch {
            _state.value=_state.value.copy(loading=true,error=null)
            try {
                val detail=api.quotation(id)
                if(detailTarget==id)_state.value=_state.value.copy(loading=false,detail=detail)
            } catch(e:Exception) {if(detailTarget==id)fail(e)}
        }
    }
    fun retry() {detailTarget?.let{openDetail(it,_state.value.preview)}?:refresh()}

    fun close() {
        detailTarget=null
        _state.value = _state.value.copy(detail = null, preview = false)
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
            draft = savedQuotationDraft(detail, revision)
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

    fun download(preview:Boolean=false) = viewModelScope.launch {
        val id = _state.value.detail?.str("id") ?: return@launch
        try {
            val bytes=api.quotationPdf(id)
            if(_state.value.detail?.str("id")==id)_state.value = _state.value.copy(pdf = bytes,pdfPreview=preview)
        } catch (e: Exception) {
            fail(e)
        }
    }

    fun previewPdf(){download(true)}
    fun sharePreviewPdf(){_state.value=_state.value.copy(pdfPreview=false)}

    fun consumedPdf() {
        _state.value = _state.value.copy(pdf = null,pdfPreview=false)
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
