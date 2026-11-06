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
    private var orderPreparationJob:Job?=null
    fun cancelOrderPreparation(){val job=orderPreparationJob;orderPreparationJob=null;if(job?.isActive==true){job.cancel();_state.value=_state.value.copy(loading=false)}}
    fun prepareOrder(id:String){if(_state.value.saving)return;cancelOrderPreparation();val previous=_state.value.draft;_state.value=_state.value.copy(loading=true,draft=null,detail=null,error=null);orderPreparationJob=viewModelScope.launch{try{val prepared=api.accountOrderPurchasePreparation(id);val draft=purchaseOrderDraft(prepared,_state.value,id);creationIdentity.reset();_state.value=_state.value.copy(loading=false,draft=draft,message="Review remaining order quantities. No bill is saved until Create Draft; posting fulfils the order.")}catch(e:CancellationException){throw e}catch(e:Exception){fail(e);_state.value=_state.value.copy(draft=previous)}}}
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
                val page = api.purchasesPage(type, query)
                val rows = page.array("rows")
                    .map {
                        SalesDocumentRow(
                            it.str("id"),
                            it.str("type"),
                            it.str("documentNumber"),
                            it.str("partyName"),
                            it.str("issueDate").take(10),
                            it.str("status"),
                            it.str("grandTotal"),it.str("outstanding"),it.str("paymentStatus")
                        )
                    }

                if (generation != refreshGeneration) return@launch
                _state.value = _state.value.copy(
                    loading = false,
                    canCreateItems=options["canCreateItems"]?.jsonPrimitive?.booleanOrNull==true,
                    invoiceCustomFields=options.array("invoiceCustomFields"),
                    accountSettings=options["accountSettings"] as? JsonObject?:JsonObject(emptyMap()),
                    rows = rows,
                    nextCursor=page.str("nextCursor").takeIf{it.isNotBlank()&&it!="null"},
                    types = options["allowedDocumentTypes"]?.jsonArray?.map { it.jsonPrimitive.content }.orEmpty(),
                    branches = options.array("branches").map { it.option() },
                    vendors = options.array("vendors").map { it.option() },
                    units = options.array("units").map { it.option() },
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

    fun create(type: String, projectId:String?=null, initialBranchId:String?=null) {
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
                taxMode=purchaseInitialTaxMode(_state.value.accountSettings),
                branchId = project?.branchId ?: _state.value.branches.firstOrNull{it.id==initialBranchId}?.id ?: _state.value.branches.firstOrNull()?.id.orEmpty(),
                purpose=if(projectId.isNullOrBlank())"INVENTORY_SALES" else "PROJECT",
                projectId=projectId.orEmpty(),
                notes=purchaseDefaultTerms(_state.value.accountSettings,type,!projectId.isNullOrBlank())
            )
        )
    }

    fun edit(draft: PurchaseDraft) {
        if (_state.value.saving) return
        _state.value = _state.value.copy(draft = purchaseTermsForContextChange(_state.value.draft,draft,_state.value.accountSettings))
    }

    fun closeDraft() {
        if (_state.value.saving) return
        cancelOrderPreparation()
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

    fun loadMore(){val s=_state.value;val cursor=s.nextCursor?:return;if(s.loading)return;val generation=refreshGeneration;_state.value=s.copy(loading=true,error=null);viewModelScope.launch{try{val page=api.purchasesPage(s.type,s.query,cursor);if(generation!=refreshGeneration)return@launch;val rows=page.array("rows").map{SalesDocumentRow(it.str("id"),it.str("type"),it.str("documentNumber"),it.str("partyName"),it.str("issueDate").take(10),it.str("status"),it.str("grandTotal"),it.str("outstanding"),it.str("paymentStatus"))};_state.value=_state.value.copy(loading=false,rows=(s.rows+rows).distinctBy{it.id},nextCursor=page.str("nextCursor").takeIf{it.isNotBlank()&&it!="null"})}catch(e:CancellationException){throw e}catch(e:Exception){if(generation==refreshGeneration)fail(e)}}}

    fun save() = saveDraft(false)
    fun saveAndNew() = saveDraft(true)
    private fun saveDraft(saveAndNew:Boolean) {
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
                if(saveAndNew)create(draft.type, initialBranchId=draft.branchId) else open(id)
                refresh()
            } catch (e: Exception) {
                fail(e)
            }
        }
    }

    fun selectCreatedPurchaseItem(index:Int,id:String,kind:String,done:()->Unit){
        val original=_state.value.draft?:return
        if(_state.value.itemReturnPending)return
        _state.value=_state.value.copy(itemReturnPending=true,itemReturnError=null)
        viewModelScope.launch{
            try{
                val options=api.purchaseOptions()
                val products=options.array("products").map{it.option("costPrice")};val services=options.array("services").map{it.option("estimatedCost")}
                val master=(if(kind=="services")services else products).firstOrNull{it.id==id}?:throw IllegalStateException("The saved item is not available in this company catalogue.")
                val current=_state.value;val draft=current.draft
                if(draft==null||draft.branchId!=original.branchId||draft.vendorId!=original.vendorId)throw IllegalStateException("The purchase context changed. Review the saved item from the catalogue.")
                val lines=draft.lines.mapIndexed{i,line->if(i==index)purchaseMasterLine(line.copy(lineType=if(kind=="services")"SERVICE" else "MATERIAL"),master,draft.taxMode) else line}
                _state.value=current.copy(draft=draft.copy(lines=lines),products=products,services=services,units=options.array("units").map{it.option()},itemReturnPending=false,itemReturnError=null)
                done()
            }catch(error:Exception){_state.value=_state.value.copy(itemReturnPending=false,itemReturnError="Item saved. Returning to the purchase failed; retry returning without creating it again.")}
        }
    }

    fun duplicatePurchase(){
        val source=_state.value.detail?:return
        if(source.str("type")!="PURCHASE_BILL"||"PURCHASE_BILL" !in _state.value.types)return
        val lines=source.array("lines").map{line->
            val snapshot=line["unitConversionSnapshot"] as? JsonObject
            SalesLineDraft(lineType=line.str("lineType"),sourceId=line.str("productId").ifBlank{line.str("serviceId").ifBlank{line.str("workPackageId")}},itemName=line.str("itemName"),quantity=line.str("quantity"),rate=line.str("rate"),taxRate=line.str("taxRate"),unitName=line.str("unitName"),unitSymbol=line.str("unitSymbol"),unitSelection=snapshot?.str("selection").orEmpty().ifBlank{"PRIMARY"},quotationUnitReviewRequired=line.str("lineType")!="CUSTOM",discountType=line.str("discountType"),discountValue=line.str("discountValue").ifBlank{"0"})
        }
        creationIdentity.reset()
        _state.value=_state.value.copy(detail=null,draft=PurchaseDraft(branchId=source.str("branchId"),vendorId=source.str("vendorId"),taxMode=source.str("taxMode"),notes=source.str("notes"),lines=lines),message="Independent purchase prepared. Review current units, supplier bill identity and allocations. Nothing was saved or posted.")
    }

    fun correctPurchase(){
        val state=_state.value;val source=state.detail?:return
        if(source.str("type")!="PURCHASE_BILL"||source.str("status")!="POSTED"||"DEBIT_NOTE" !in state.types)return
        if(state.sources.none{it.str("id")==source.str("id")}){_state.value=state.copy(error="This bill has no eligible remaining return. Refresh before preparing a correction.");return}
        creationIdentity.reset()
        _state.value=state.copy(detail=null,draft=PurchaseDraft(type="DEBIT_NOTE",branchId=source.str("branchId"),vendorId=source.str("vendorId"),sourceDocumentId=source.str("id"),taxMode=source.str("taxMode"),notes="Correction of ${source.str("documentNumber")}. Review quantities and physical stock return.",lines=source.array("lines").map{purchaseSourceLine(it).copy(stockReturnQuantity="0")}),message="Correction prepared for review. Original bill, payments and stock history remain unchanged until you explicitly save and post the debit note.")
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
        val confirmingOrder=_state.value.detail?.str("type")=="PURCHASE_ORDER"
        _state.value = _state.value.copy(saving = true, error = null)
        viewModelScope.launch {
            try {
                if(confirmingOrder)api.confirmAccountPurchaseOrder(id)else api.postPurchase(id)
                _state.value = _state.value.copy(
                    posting = null,
                    saving = false,
                    detail = api.purchase(id),
                    message = if(confirmingOrder)"Purchase order confirmed. No journal posted."else"Purchase document posted by the server."
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
