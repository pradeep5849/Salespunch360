package com.salespunch360.mobile.ui.account.sales

import com.salespunch360.mobile.ui.account.accountMoney
import com.salespunch360.mobile.ui.account.accountDate
import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import com.salespunch360.mobile.data.QuotationCreationAttachment
import com.salespunch360.mobile.ui.account.expense.readExpenseAttachment
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Description
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.quotationPreview
import com.salespunch360.mobile.AccountMasterViewModel
import com.salespunch360.mobile.ui.account.AccountMasterScreen
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.salespunch360.mobile.AccountAddItemViewModel
import com.salespunch360.mobile.ui.account.inventory.AddItemScreen
import com.salespunch360.mobile.QuotationDraft
import com.salespunch360.mobile.QuotationState
import com.salespunch360.mobile.QuotationViewModel
import com.salespunch360.mobile.account.SalesLineDraft
import com.salespunch360.mobile.account.array
import com.salespunch360.mobile.account.str
import java.io.File
import kotlinx.serialization.json.*

@Composable
fun QuotationScreen(padding: PaddingValues, vm: QuotationViewModel = viewModel(), initialDocumentId:String?=null,navigate:(String)->Unit) {
    LaunchedEffect(initialDocumentId){initialDocumentId?.let(vm::open)}
    val state = vm.state.collectAsStateWithLifecycle().value
    val context = LocalContext.current
    LaunchedEffect(state.pdf,state.pdfPreview) {
        if(state.pdfPreview)return@LaunchedEffect
        state.pdf?.let { bytes ->
            val file = File(context.cacheDir, "quotation.pdf")
            file.writeBytes(bytes)
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
            val send = Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            context.startActivity(Intent.createChooser(send, "Share quotation"))
            vm.consumedPdf()
        }
    }
    if(state.pdfPreview)state.pdf?.let { bytes ->QuotationPdfPreview(bytes,onClose=vm::consumedPdf,onShare=vm::sharePreviewPdf) }
    state.shareToken?.let { token ->
        LaunchedEffect(token) {
            val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "https://www.salespunch360.com/share/quotation/$token")
            context.startActivity(Intent.createChooser(send, "Share quotation link"))
        }
    }
    Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
        Text("Estimate Details",style=MaterialTheme.typography.headlineSmall)
        Row {
            OutlinedTextField(state.query, vm::search, label = { Text("Search estimates") }, modifier = Modifier.weight(1f))
            IconButton(onClick = vm::refresh) { Icon(Icons.Default.Refresh, "Refresh") }
            if(state.canCreate)FilledIconButton(onClick = vm::createEstimate,enabled=!state.saving) { Icon(Icons.Default.Add, "Add Estimate") }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            item { FilterChip(state.status == null, { vm.filter(null) }, { Text("All") }) }
            items(listOf("OPEN", "CLOSED")) { status ->
                FilterChip(state.status == status, { vm.filter(status) }, { Text(status.lowercase().replaceFirstChar{it.uppercase()}) })
            }
        }
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        state.message?.let { Text(it) }
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error);TextButton(vm::retry,enabled=!state.saving){Text("Retry loading")} }
        LazyColumn(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(12.dp)) {
            if(!state.loading&&state.error==null&&state.rows.isEmpty())item{Column(Modifier.fillMaxWidth().padding(vertical=40.dp),horizontalAlignment=androidx.compose.ui.Alignment.CenterHorizontally){Icon(Icons.Default.Description,null,Modifier.size(96.dp),tint=MaterialTheme.colorScheme.primary);Text(if(state.query.isNotBlank()||state.status!=null)"No matching estimates"else "No estimates yet",style=MaterialTheme.typography.titleLarge);Text(if(state.query.isNotBlank()||state.status!=null)"Try another party name, number or status."else "Create an estimate for your next sale.");if(state.canCreate)Button(vm::createEstimate,enabled=!state.saving){Text("Add Estimate")}}}
            items(state.rows, key = { it.id }) { quotation ->
                ElevatedCard(onClick={vm.open(quotation.id)},modifier=Modifier.fillMaxWidth()){
                    Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(quotation.customer.ifBlank{"Customer not provided"},fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f));Text(accountMoney(quotation.total),fontWeight=FontWeight.Bold)}
                        Text("${quotation.type} · ${quotation.number} · R${quotation.revision}")
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(quotation.status.replace('_',' '));Text(accountDate(quotation.issueDate))}
                    }
                }
            }
        }
    }

    state.draft?.let { QuotationEditor(it, state, vm,navigate) }
    if(state.draft==null&&!(state.pdfPreview&&state.pdf!=null))state.detail?.let { QuotationDetail(it, vm, state.preview,state.stateOfSupplyOptions) }
}

@Composable
private fun QuotationEditor(draft: QuotationDraft, state: QuotationState, vm: QuotationViewModel,navigate:(String)->Unit) {
    val attachmentContext=LocalContext.current
    val attachmentScope=rememberCoroutineScope()
    var readingAttachment by remember(draft.creationRequestKey){mutableStateOf(false)}
    var creationAttachmentError by remember(draft.creationRequestKey){mutableStateOf<String?>(null)}
    val creationPicker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()){uri->
        if(uri!=null)attachmentScope.launch{
            readingAttachment=true;creationAttachmentError=null
            try{val(name,mime,bytes)=readExpenseAttachment(attachmentContext,uri);vm.addCreationAttachment(QuotationCreationAttachment(name,mime,bytes),draft.creationRequestKey)}catch(e:CancellationException){throw e}catch(e:Exception){creationAttachmentError=quotationAttachmentError(e)}finally{readingAttachment=false}
        }
    }
    var newItemLine by remember { mutableStateOf<Int?>(null) }
    if(newItemLine!=null){
        val itemVm:AccountAddItemViewModel=viewModel(key="quotation-item-${draft.creationRequestKey}")
        val index=newItemLine!!
        LaunchedEffect(index){itemVm.beginCreate()}
        Dialog(onDismissRequest={if(!itemVm.state.value.saving&&!state.itemReturnPending&&itemVm.state.value.createdItemId==null)newItemLine=null},properties=DialogProperties(usePlatformDefaultWidth=false)){
            Surface(Modifier.fillMaxSize()){AddItemScreen(back={if(!itemVm.state.value.saving)newItemLine=null},navigate=navigate,vm=itemVm,initialService=draft.lines[index].lineType=="SERVICE",returnPending=state.itemReturnPending,returnError=state.itemReturnError,onCreated={id,kind->vm.selectCreatedItem(index,id,kind){newItemLine=null}})}
        };return
    }
    var newPartyOpen by remember { mutableStateOf(false) }
    var partyQuery by remember { mutableStateOf("") }
    LaunchedEffect(draft.customerId,draft.branchId,state.canViewPartyBalance){vm.loadPartyBalance(draft.customerId,draft.branchId)}
    if(newPartyOpen){
        val partyVm:AccountMasterViewModel=viewModel(key="quotation-party-${draft.creationRequestKey}")
        Dialog(onDismissRequest={if(!partyVm.state.value.saving)newPartyOpen=false},properties=DialogProperties(usePlatformDefaultWidth=false)){
            Surface(Modifier.fillMaxSize()){
                AccountMasterScreen("customers",PaddingValues(0.dp),vm=partyVm,initialCreate=true,canCreate=state.canCreateParty,initialBranchId=draft.branchId,lockCreateBranch=true,cancelLabel="Return to estimate",onCancel={newPartyOpen=false},onCreatedRecord={party->vm.selectCreatedParty(party);partyQuery="";newPartyOpen=false})
            }
        }
        return
    }
    var termsExpanded by remember(draft.creationRequestKey){mutableStateOf(false)}
    Dialog(onDismissRequest={if(!readingAttachment)vm.closeDraft()},properties=DialogProperties(usePlatformDefaultWidth=false)){
        Surface(Modifier.fillMaxSize()){
            Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()){
                Row(Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=8.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){
                    Text(when{draft.id==null->"New quotation";draft.revision->"New revision";else->"Edit quotation"},style=MaterialTheme.typography.titleLarge,modifier=Modifier.weight(1f))
                    TextButton(enabled=!state.saving&&!readingAttachment,onClick=vm::closeDraft){Text("Cancel")}
                }
                HorizontalDivider()
                state.error?.let{Text(it,color=MaterialTheme.colorScheme.error,modifier=Modifier.fillMaxWidth().padding(12.dp))}
                LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(horizontal=12.dp),contentPadding=PaddingValues(vertical=12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                item { OutlinedTextField(state.companyName.ifBlank{"Current company"},{},readOnly=true,label={Text("Firm Name")},modifier=Modifier.fillMaxWidth()) }
                state.error?.let { error -> item { Text(error,color=MaterialTheme.colorScheme.error) } }
                if(draft.id==null) {
                item { SelectField("Type", draft.documentType, listOf("QUOTATION" to "Quotation", "ESTIMATE" to "Estimate", "BOQ" to "BOQ")) { vm.editDraft(draft.copy(documentType = it)) } }
                item { SelectField("Branch", draft.branchId, state.branches.map { it.id to it.name }) { partyQuery="";vm.editDraft(draft.copy(branchId = it, customerId = "")) } }
                item { OutlinedTextField(partyQuery,{partyQuery=it},label={Text("Search saved parties")},modifier=Modifier.fillMaxWidth()) }
                item { SelectField("Customer", draft.customerId, state.customers.filter { it.branchId==draft.branchId&&(it.id==draft.customerId||"${it.name} ${it.phone.orEmpty()}".contains(partyQuery.trim(),ignoreCase=true)) }.map { it.id to it.name }) { vm.editDraft(draft.copy(customerId = it)) } }
                if(state.canCreateParty)item { OutlinedButton({newPartyOpen=true},enabled=draft.branchId.isNotBlank()&&!state.saving){Text("Add new party")} }
                } else {
                    item { Text("Type: ${draft.documentType}") }
                    item { Text("Branch: ${state.branches.firstOrNull{it.id==draft.branchId}?.name?:draft.branchId}") }
                    item { Text("Customer: ${state.customers.firstOrNull{it.id==draft.customerId}?.name?:state.detail?.array("revisions")?.firstOrNull()?.str("customerName").orEmpty()}") }
                }
                if(state.canViewPartyBalance&&draft.customerId.isNotBlank())item {
                    val balance=state.partyBalance?.takeIf{it.str("partyId")==draft.customerId&&it.str("branchId")==draft.branchId}
                    val amount=balance?.str("balance")?.takeIf{it.isNotBlank()}
                    Column {
                        Text("Party balance: ${if(amount!=null)accountMoney(amount)else if(balance?.get("error")?.jsonPrimitive?.booleanOrNull==true)"Unavailable"else "Loading…"}")
                        if(balance?.get("error")?.jsonPrimitive?.booleanOrNull==true)TextButton({vm.loadPartyBalance(draft.customerId,draft.branchId)}){Text("Retry party balance")}
                    }
                }
                item { OutlinedTextField(draft.billingName, { vm.editDraft(draft.copy(billingName = it)) }, label = { Text("Billing Name (Optional)") }, isError=draft.billingName.length>240) }
                item { OutlinedTextField(draft.issueDate, { vm.editDraft(draft.copy(issueDate = it)) }, label = { Text("Issue date") }) }
                item { OutlinedTextField(draft.validUntil, { vm.editDraft(draft.copy(validUntil = it)) }, label = { Text("Valid until") }) }
                itemsIndexed(draft.lines) { index, line -> QuotationLine(index, line, state, vm){newItemLine=index} }
                item { OutlinedButton(onClick = vm::addLine) { Text("Add line") } }
                itemsIndexed(draft.adjustments) { index, adjustment ->
                    fun value(key:String)=(adjustment[key] as? JsonPrimitive)?.contentOrNull.orEmpty()
                    fun change(key:String,next:JsonElement){vm.editDraft(draft.copy(adjustments=draft.adjustments.mapIndexed { n,row -> if(n==index)JsonObject(row+mapOf(key to next))else row }))}
                    ElevatedCard {
                        Column(Modifier.padding(10.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                            Text("Adjustment ${index+1}",style=MaterialTheme.typography.titleSmall)
                            SelectField("Adjustment type",value("type"),listOf("DISCOUNT" to "Discount","ADDITIONAL_CHARGE" to "Additional charge")){change("type",JsonPrimitive(it))}
                            OutlinedTextField(value("label"),{change("label",JsonPrimitive(it))},label={Text("Adjustment label")})
                            SelectField("Adjustment value type",value("valueType"),listOf("FIXED" to "Fixed amount","PERCENTAGE" to "Percentage")){change("valueType",JsonPrimitive(it))}
                            OutlinedTextField(value("value"),{change("value",JsonPrimitive(it))},label={Text("Adjustment value")})
                            if(value("type")=="ADDITIONAL_CHARGE") {
                                FilterChip(selected=(adjustment["taxable"] as? JsonPrimitive)?.booleanOrNull==true,onClick={change("taxable",JsonPrimitive((adjustment["taxable"] as? JsonPrimitive)?.booleanOrNull!=true))},label={Text("Taxable charge")})
                                OutlinedTextField(value("taxRate").ifBlank{"0"},{change("taxRate",JsonPrimitive(it))},label={Text("Charge tax %")})
                            }
                            TextButton({vm.editDraft(draft.copy(adjustments=draft.adjustments.filterIndexed { n,_ -> n!=index }))}){Text("Remove adjustment")}
                        }
                    }
                }
                item {
                    OutlinedButton({vm.editDraft(draft.copy(adjustments=draft.adjustments+buildJsonObject{put("type","DISCOUNT");put("label","Discount");put("valueType","FIXED");put("value","0")}))}){Text("Add discount / charge")}
                }
                if(draft.id==null)item {
                    Column(verticalArrangement=Arrangement.spacedBy(6.dp)){
                        Text("Attachments",style=MaterialTheme.typography.titleSmall)
                        Text("PDF, PNG or JPEG; up to 10 MB combined. Saved only when you Save; private to authorized staff.")
                        OutlinedButton(enabled=!state.saving&&!readingAttachment,onClick={creationPicker.launch(arrayOf("application/pdf","image/png","image/jpeg"))}){Text(if(readingAttachment)"Reading file…"else"Add quotation file")}
                        state.creationAttachments.forEachIndexed{index,file->Text(file.name);TextButton(enabled=!state.saving&&!readingAttachment,onClick={vm.removeCreationAttachment(index)}){Text("Remove ${file.name}")}}
                        creationAttachmentError?.let{Text(it,color=MaterialTheme.colorScheme.error)}
                    }
                }
                item { TextButton(onClick={termsExpanded=!termsExpanded},modifier=Modifier.fillMaxWidth().heightIn(min=48.dp)){Text("Terms & Conditions — ${if(termsExpanded)"Hide"else"Show"}")} }
                if(termsExpanded){
                    item { OutlinedTextField(draft.terms, { vm.editDraft(draft.copy(terms = it)) }, label = { Text("Terms") }, minLines = 2,modifier=Modifier.fillMaxWidth()) }
                    item { OutlinedTextField(draft.inclusions, { vm.editDraft(draft.copy(inclusions = it)) }, label = { Text("Inclusions") },modifier=Modifier.fillMaxWidth()) }
                    item { OutlinedTextField(draft.exclusions, { vm.editDraft(draft.copy(exclusions = it)) }, label = { Text("Exclusions") },modifier=Modifier.fillMaxWidth()) }
                }
                item { InvoiceCustomFields(state.customFields,"QUOTATION",draft.customFields,state.saving){vm.editDraft(draft.copy(customFields=it))} }
                item { OutlinedTextField(draft.notes, { vm.editDraft(draft.copy(notes = it)) }, label = { Text("Notes") }) }
                item { SelectField("Rate tax mode",draft.taxMode,listOf("EXCLUSIVE" to "Tax exclusive","INCLUSIVE" to "Tax inclusive")){vm.editDraft(draft.copy(taxMode=it))} }
                item { SelectField("State of Supply",draft.stateOfSupplyCode,listOf("" to "Not recorded")+state.stateOfSupplyOptions){vm.editDraft(draft.copy(stateOfSupplyCode=it))} }
                item { FilterChip(selected=draft.roundOffEnabled,onClick={vm.editDraft(draft.copy(roundOffEnabled=!draft.roundOffEnabled))},label={Text("Round Off")},enabled=!state.saving) }
                item {
                    val totals=quotationPreview(draft)
                    Column(verticalArrangement=Arrangement.spacedBy(4.dp)) {
                        Text("Totals",style=MaterialTheme.typography.titleMedium)
                        Text("Rates ${if(draft.taxMode=="INCLUSIVE")"include"else"exclude"} tax. Totals use shared tax rounding and are recalculated when you save.",style=MaterialTheme.typography.bodySmall)
                        if(totals==null)Text("Enter valid quantities, rates, discounts and GST percentages to preview totals.")
                        else listOf("Subtotal" to totals.subtotal,"Discount" to totals.discount,"Additional charges" to totals.charges,"Taxable amount" to totals.taxable,"Tax" to totals.tax,"Round off" to totals.roundOff,"Total amount" to totals.total).forEach { (label,amount) ->
                            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(label,modifier=Modifier.weight(1f));Text(accountMoney(amount))}
                        }
                    }
                }
                }
                HorizontalDivider()
                Row(Modifier.fillMaxWidth().padding(12.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){
                    if(draft.id==null)OutlinedButton(enabled=!readingAttachment&&!state.saving&&draft.customerId.isNotBlank()&&invoiceCustomFieldsValid(state.customFields,"QUOTATION",draft.customFields),onClick=vm::saveAndNew,modifier=Modifier.weight(1f).heightIn(min=56.dp)){Text("Save & New")}
                    Button(enabled=!readingAttachment&&!state.saving&&invoiceCustomFieldsValid(state.customFields,"QUOTATION",draft.customFields)&&draft.customerId.isNotBlank()&&draft.lines.isNotEmpty(),onClick=vm::save,modifier=Modifier.weight(1f).heightIn(min=56.dp)){Text(if(state.saving)"Saving…"else"Save")}
                }
            }
        }
    }
}

@Composable
private fun QuotationLine(index: Int, line: SalesLineDraft, state: QuotationState, vm: QuotationViewModel,createItem:()->Unit) {
    var itemQuery by remember(line.lineType,index){mutableStateOf("")}
    val masters = when (line.lineType) { "PRODUCT" -> state.products; "SERVICE" -> state.services; "WORK_PACKAGE" -> state.workPackages; else -> emptyList() }
    ElevatedCard {
        Column(Modifier.padding(10.dp)) {
            SelectField("Line type", line.lineType, listOf("PRODUCT" to "Product", "SERVICE" to "Service", "WORK_PACKAGE" to "Work package", "CUSTOM" to "Custom")) { vm.line(index, line.copy(lineType = it, sourceId = "")) }
            if (line.lineType == "CUSTOM") {
                OutlinedTextField(line.itemName, { vm.line(index, line.copy(itemName = it)) }, label = { Text("Name") })
            } else {
                OutlinedTextField(itemQuery,{itemQuery=it},label={Text("Search saved items")},placeholder={Text("Item name or code")})
                SelectField("Item", line.sourceId, masters.filter{it.id==line.sourceId||"${it.name} ${it.code.orEmpty()}".contains(itemQuery.trim(),ignoreCase=true)}.map { it.id to it.name }) { id -> val master = masters.first { it.id == id }; vm.line(index, line.copy(sourceId = id, rate = master.rate.orEmpty(), taxRate = master.taxRate.orEmpty())) }
            }
            if(state.canCreateItem&&line.lineType in listOf("PRODUCT","SERVICE"))OutlinedButton(onClick=createItem,enabled=!state.saving){Text("Add new item")}
            if(state.canCost)masters.firstOrNull{it.id==line.sourceId}?.costPrice?.let{Text("Saved ${if(line.lineType=="PRODUCT")"purchase"else "estimated"} unit cost: ${accountMoney(it)}")}
            if(line.lineType=="PRODUCT"&&state.stockAvailable&&masters.firstOrNull{it.id==line.sourceId}?.trackInventory==true){
                val quantity=state.stockPositions.firstOrNull{it.str("productId")==line.sourceId&&it.str("branchId")==state.draft?.branchId}?.str("quantity")?:"0.0000"
                Text("Recorded stock in selected branch (primary unit): $quantity")
            }
            Row {
                OutlinedTextField(line.quantity, { vm.line(index, line.copy(quantity = it)) }, label = { Text("Qty") }, modifier = Modifier.weight(1f))
                OutlinedTextField(line.rate, { vm.line(index, line.copy(rate = it)) }, label = { Text("Rate") }, modifier = Modifier.weight(1f))
            }
            OutlinedTextField(line.taxRate, { vm.line(index, line.copy(taxRate = it)) }, label = { Text("GST %") })
            SelectField("Line discount type",line.discountType,listOf("" to "None","PERCENTAGE" to "Percentage","FIXED" to "Fixed amount")){vm.line(index,line.copy(discountType=it))}
            if(line.discountType.isNotBlank())OutlinedTextField(line.discountValue,{vm.line(index,line.copy(discountValue=it))},label={Text("Line discount value")})
            if ((state.draft?.lines?.size ?: 0) > 1) TextButton(onClick = { vm.removeLine(index) }) { Text("Remove") }
        }
    }
}

@Composable
private fun QuotationDetail(quotation: JsonObject, vm: QuotationViewModel, preview: Boolean,states:List<Pair<String,String>>) {
    val revision = quotation.array("revisions").firstOrNull()
    val capabilities=quotation["capabilities"] as? JsonObject
    val allowedTransitions = quotation["allowedTransitions"]?.jsonArray?.map { it.jsonPrimitive.content }.orEmpty()
    AlertDialog(
        onDismissRequest = vm::close,
        title = { Text(quotation.str("documentNumber")) },
        confirmButton = {},
        dismissButton = { TextButton(onClick = vm::close) { Text(if(preview) "Close preview" else "Close") } },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    Text("${quotation.str("documentType")} · ${quotation.str("status")}", fontWeight = FontWeight.Bold)
                    Text(revision?.str("customerName").orEmpty())
                    Text("Rates ${if(revision?.str("taxMode")=="INCLUSIVE")"include"else"exclude"} tax.")
                    revision?.str("billingName")?.takeIf{it.isNotBlank()}?.let{Text("Billing name: $it")}
                    Text("State of supply: ${states.firstOrNull{it.first==revision?.str("stateOfSupplyCode")}?.second?:revision?.str("stateOfSupplyCode").orEmpty().ifBlank{"Not recorded"}}")
                    Text("Round off ${accountMoney(revision?.str("roundOffAmount").orEmpty().ifBlank{"0"})}")
                    Text("Grand total ${accountMoney(revision?.str("grandTotal").orEmpty())}")
                }
                revision?.array("lines")?.let { lines -> items(lines) { line -> Text("${line.str("itemName")} · ${line.str("quantity")} × ${accountMoney(line.str("rate"))} = ${accountMoney(line.str("lineTotal"))}") } }
                item { QuotationAttachmentControls(quotation.str("id"),revision?.get("revisionNumber")?.jsonPrimitive?.intOrNull?:0,capabilities?.get("canEdit")?.jsonPrimitive?.booleanOrNull==true) }
                item {
                    if(!preview) allowedTransitions.forEach { target -> Button(onClick = { vm.transition(target) }, modifier = Modifier.fillMaxWidth()) { Text(target.replace('_', ' ')) } }
                    if (!preview && (capabilities?.get("canEdit")?.jsonPrimitive?.booleanOrNull==true || capabilities?.get("canRevise")?.jsonPrimitive?.booleanOrNull==true)) {
                        OutlinedButton(onClick = vm::revise, modifier = Modifier.fillMaxWidth()) { Text(if (quotation.str("status") == "DRAFT") "Edit" else "Create revision") }
                    }
                    if (!preview && capabilities?.get("canShare")?.jsonPrimitive?.booleanOrNull==true) OutlinedButton(onClick = vm::share, modifier = Modifier.fillMaxWidth()) { Text("Share link") }
                    OutlinedButton(onClick = vm::previewPdf, modifier = Modifier.fillMaxWidth()) { Text("Print preview") }
                    OutlinedButton(onClick = {vm.download()}, modifier = Modifier.fillMaxWidth()) { Text("Download / share PDF") }
                }
            }
        }
    )
}
