package com.salespunch360.mobile.ui.account.sales

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.clickable
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.font.FontWeight
import com.salespunch360.mobile.account.*
import kotlinx.serialization.json.JsonObject

@Composable
fun SalesDocumentEditor(
    draft: SalesEditorDraft,
    options: SalesOptions,
    saving: Boolean,
    onDraft: (SalesEditorDraft) -> Unit,
    onAdd: () -> Unit,
    onLine: (Int, SalesLineDraft) -> Unit,
    onRemove: (Int) -> Unit,
    onClose: () -> Unit,
    onSave: () -> Unit,
    onPrefix:(String)->Unit,
    onCreateCustomer:(String,String,(String)->Unit)->Unit,
    navigate:(String)->Unit
) {
    if (draft.type == "SALES_INVOICE") {
        DirectSaleInvoiceEditor(draft, options, saving, onDraft, onAdd, onLine, onRemove, onClose, onSave,onPrefix,onCreateCustomer,navigate)
        return
    }
    val sources = options.sourceDocuments.filter {
        it.str("type") == "SALES_INVOICE" && it.str("branchId") == draft.branchId && it.str("customerId") == draft.customerId
    }
    val sourceLines = sources.firstOrNull { it.str("id") == draft.sourceDocumentId }?.array("lines").orEmpty()
    AlertDialog(
        onDismissRequest = { if (!saving) onClose() },
        title = { Text("New ${draft.type.replace('_', ' ')}") },
        confirmButton = {
            Button(
                enabled = !saving && draft.branchId.isNotBlank() && draft.customerId.isNotBlank() && draft.lines.all {
                    it.quantity.toDoubleOrNull()?.let { quantity -> quantity > 0 } == true && (it.sourceId.isNotBlank() || it.itemName.isNotBlank())
                },
                onClick = onSave
            ) { Text(if (saving) "Saving…" else "Create draft") }
        },
        dismissButton = { TextButton(enabled = !saving, onClick = onClose) { Text("Cancel") } },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                item { SelectField("Document type", draft.type, options.types.map { it to it.replace('_', ' ') }) { onDraft(draft.copy(type = it)) } }
                item { SelectField("Branch", draft.branchId, options.branches.map { it.id to it.name }) { onDraft(draft.copy(branchId = it, customerId = "")) } }
                item { SelectField("Customer", draft.customerId, options.customers.filter { it.branchId == draft.branchId }.map { it.id to it.name }) { onDraft(draft.copy(customerId = it)) } }
                if (draft.type == "CREDIT_NOTE") item { SelectField("Original invoice", draft.sourceDocumentId, sources.map { it.str("id") to it.str("documentNumber") }) { onDraft(draft.copy(sourceDocumentId = it)) } }
                item { OutlinedTextField(draft.issueDate, { onDraft(draft.copy(issueDate = it)) }, label = { Text("Issue date (YYYY-MM-DD)") }) }
                item { OutlinedTextField(draft.dueDate, { onDraft(draft.copy(dueDate = it)) }, label = { Text("Due date (optional)") }) }
                item { SelectField("Tax mode", draft.taxMode, listOf("EXCLUSIVE" to "Exclusive", "INCLUSIVE" to "Inclusive")) { onDraft(draft.copy(taxMode = it)) } }
                item { OutlinedTextField(draft.stateOfSupplyCode, { onDraft(draft.copy(stateOfSupplyCode = it)) }, label = { Text("State of supply code") }) }
                itemsIndexed(draft.lines) { index, line -> SalesLineEditor(index, line, draft, options, sourceLines, onLine, onRemove) }
                item { OutlinedButton(onClick = onAdd, modifier = Modifier.fillMaxWidth()) { Text("Add line") } }
                item { OutlinedTextField(draft.notes, { onDraft(draft.copy(notes = it)) }, label = { Text("Notes") }, minLines = 2) }
                item { Text("Displayed line values are previews. Tax, totals, numbering, stock, and posting are confirmed by the server.", style = MaterialTheme.typography.bodySmall) }
            }
        }
    )
}

/** Native B5 surface. It deliberately delegates lines and save to the existing sales ViewModel/API. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun DirectSaleInvoiceEditor(draft:SalesEditorDraft,options:SalesOptions,saving:Boolean,onDraft:(SalesEditorDraft)->Unit,onAdd:()->Unit,onLine:(Int,SalesLineDraft)->Unit,onRemove:(Int)->Unit,onClose:()->Unit,onSave:()->Unit,onPrefix:(String)->Unit,onCreateCustomer:(String,String,(String)->Unit)->Unit,navigate:(String)->Unit){
    var cash by rememberSaveable{mutableStateOf(false)};var customerSheet by remember{mutableStateOf(false)};var customerQuery by remember{mutableStateOf("")};var addCustomer by remember{mutableStateOf(false)};var customerName by remember{mutableStateOf("")};var customerPhone by remember{mutableStateOf("")};var settings by remember{mutableStateOf(false)};var invoiceDialog by remember{mutableStateOf(false)};var prefixDraft by remember{mutableStateOf("")};var items by remember{mutableStateOf(false)};var datePicker by remember{mutableStateOf(false)}
    Scaffold(topBar={TopAppBar(title={Text("Sale")},navigationIcon={TextButton(onClick=onClose){Text("‹ Back")}},actions={SingleChoiceSegmentedButtonRow{listOf("Credit","Cash").forEachIndexed{i,label->SegmentedButton(selected=cash==(i==1),onClick={cash=i==1},shape=SegmentedButtonDefaults.itemShape(i,2)){Text(label)}}};IconButton(onClick={settings=true}){Text("⚙")}})},bottomBar={Surface(shadowElevation=8.dp){Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(10.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){OutlinedButton(onClick=onSave,enabled=!saving,modifier=Modifier.weight(1f)){Text("Save & New")};Button(onClick=onSave,enabled=!saving,modifier=Modifier.weight(1f)){Text(if(saving)"Saving…" else "Save")};IconButton(onClick={settings=true}){Text("⋮")}}}}){padding->LazyColumn(Modifier.fillMaxSize().padding(padding).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Column(Modifier.clickable{invoiceDialog=true}){Text("Invoice No.",style=MaterialTheme.typography.labelSmall);val series=options.numberingSeries.firstOrNull{it.branchId==draft.branchId};Text(series?.let{"${it.prefix}${it.nextSequence.toString().padStart(maxOf(2,it.padding),'0')}${it.suffix} ⌄"}?:"01 ⌄",fontWeight=FontWeight.Bold)};Column(Modifier.clickable{datePicker=true},horizontalAlignment=Alignment.End){Text("Date",style=MaterialTheme.typography.labelSmall);Text("${draft.issueDate} ⌄",fontWeight=FontWeight.Bold)}}};item{if(options.projects.isNotEmpty())SelectField("Project (optional for regular sale)",draft.projectId,options.projects.filter{it.branchId==draft.branchId}.map{it.id to it.name}){id->onDraft(draft.copy(projectId=id))}};item{OutlinedButton(onClick={customerSheet=true},modifier=Modifier.fillMaxWidth()){Text(options.customers.firstOrNull{it.id==draft.customerId}?.name?:"Search or select customer")}};item{OutlinedTextField("",{},label={Text("Billing Name (Optional)")},modifier=Modifier.fillMaxWidth())};item{OutlinedButton(onClick={items=true},modifier=Modifier.fillMaxWidth()){Text("+ Add Items (Optional)")}};itemsIndexed(draft.lines){index,line->SalesLineEditor(index,line,draft,options,emptyList(),onLine,onRemove)};item{Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Total Amount",fontWeight=FontWeight.Bold);Text("Server calculated",fontWeight=FontWeight.Bold)}}}}
    if(customerSheet)ModalBottomSheet(onDismissRequest={customerSheet=false}){Column(Modifier.fillMaxWidth().padding(16.dp)){OutlinedTextField(customerQuery,{customerQuery=it},label={Text("Search parties")},modifier=Modifier.fillMaxWidth());Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("Showing Saved Parties",fontWeight=FontWeight.Bold);TextButton(onClick={addCustomer=true}){Text("Add new party")}};options.customers.filter{it.name.contains(customerQuery,true)}.forEach{party->ListItem(headlineContent={Text(party.name)},supportingContent=party.phone?.let { phone -> { Text(phone) } },trailingContent={Text("›")},modifier=Modifier.clickable{onDraft(draft.copy(customerId=party.id));customerSheet=false})}}}
    if(addCustomer)AlertDialog(onDismissRequest={addCustomer=false},title={Text("Add new party")},text={Column{OutlinedTextField(customerName,{customerName=it},label={Text("Customer name")});OutlinedTextField(customerPhone,{customerPhone=it},label={Text("Phone")})}},confirmButton={Button(enabled=customerName.isNotBlank()&&!saving,onClick={onCreateCustomer(customerName,customerPhone){id->onDraft(draft.copy(customerId=id));addCustomer=false;customerSheet=false}}){Text("Save")}},dismissButton={TextButton(onClick={addCustomer=false}){Text("Cancel")}})
    if(datePicker){
        val state=rememberDatePickerState()
        DatePickerDialog(
            onDismissRequest={datePicker=false},
            confirmButton={
                TextButton(
                    onClick={
                        state.selectedDateMillis?.let{
                            onDraft(
                                draft.copy(
                                    issueDate=java.time.Instant.ofEpochMilli(it)
                                        .atZone(java.time.ZoneOffset.UTC)
                                        .toLocalDate()
                                        .toString()
                                )
                            )
                        }
                        datePicker=false
                    }
                ){Text("OK")}
            }
        ){DatePicker(state=state)}
    }
    if(invoiceDialog){val current=options.numberingSeries.firstOrNull{it.branchId==draft.branchId}?.prefix.orEmpty();AlertDialog(onDismissRequest={invoiceDialog=false},title={Text("Change Invoice No.")},text={Column{Text("Invoice Prefix");SingleChoiceSegmentedButtonRow{SegmentedButton(selected=current.isBlank(),onClick={onPrefix("");prefixDraft=""},shape=SegmentedButtonDefaults.itemShape(0,2)){Text("None")};SegmentedButton(selected=current.isNotBlank(),onClick={prefixDraft=current},shape=SegmentedButtonDefaults.itemShape(1,2)){Text("Add Prefix")}};OutlinedTextField(prefixDraft,{prefixDraft=it},label={Text("Prefix")});Text("Preview updates from the canonical NumberingSeries.")}},confirmButton={Button(enabled=!saving,onClick={val normalized=prefixDraft.trim().trimEnd('-').let{if(it.isBlank())"" else "$it-"};onPrefix(normalized);invoiceDialog=false}){Text("SAVE")}},dismissButton={TextButton(onClick={invoiceDialog=false}){Text("Close")}})}
    if(items)ModalBottomSheet(onDismissRequest={items=false}){LazyColumn(Modifier.fillMaxWidth().padding(16.dp)){item{Text("Add Items",style=MaterialTheme.typography.titleLarge)};items(options.products){product->ListItem(headlineContent={Text(product.name)},modifier=Modifier.clickable{onLine(0,draft.lines.first().copy(lineType="PRODUCT",sourceId=product.id,itemName=product.name,rate=product.rate.orEmpty(),taxRate=product.taxRate.orEmpty()));items=false})}}}
    if(settings)ModalBottomSheet(onDismissRequest={settings=false}){Column(Modifier.fillMaxWidth().padding(20.dp),verticalArrangement=Arrangement.spacedBy(16.dp)){Text("Sale Settings",style=MaterialTheme.typography.titleLarge);TextButton(onClick={settings=false;invoiceDialog=true}){Text("Sale Prefix")};Text("Transaction SMS · Not enabled");Text("Additional Fields  ›");Text("Additional Charges  ›");Text("Billing Type",fontWeight=FontWeight.Bold);Text("◉ Full Sale");Text("○ Mobile POS — Coming Soon",color=MaterialTheme.colorScheme.onSurfaceVariant);TextButton(onClick={settings=false;navigate("/workspace/account/settings/transactions")}){Text("⚙ More Settings")}}}
}

@Composable
private fun SalesLineEditor(
    index: Int,
    line: SalesLineDraft,
    draft: SalesEditorDraft,
    options: SalesOptions,
    sourceLines: List<JsonObject>,
    onLine: (Int, SalesLineDraft) -> Unit,
    onRemove: (Int) -> Unit
) {
    val masters = when (line.lineType) { "PRODUCT" -> options.products; "SERVICE" -> options.services; "WORK_PACKAGE" -> options.workPackages; else -> emptyList() }
    ElevatedCard {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Line ${index + 1}")
            if (draft.type == "CREDIT_NOTE") {
                SelectField("Original line", line.sourceCommercialLineId, sourceLines.map { it.str("id") to "${it.str("itemName")} · ${it.str("quantity")}" }) { id ->
                    val source = sourceLines.first { it.str("id") == id }
                    onLine(index, line.copy(
                        sourceCommercialLineId = id,
                        lineType = source.str("lineType"),
                        sourceId = source.str("productId").ifBlank { source.str("serviceId").ifBlank { source.str("workPackageId") } },
                        itemName = source.str("itemName"),
                        quantity = source.str("quantity"),
                        rate = source.str("rate"),
                        taxRate = source.str("taxRate")
                    ))
                }
            }
            SelectField("Type", line.lineType, listOf("PRODUCT" to "Product", "SERVICE" to "Service", "WORK_PACKAGE" to "Work package", "CUSTOM" to "Custom")) { onLine(index, line.copy(lineType = it, sourceId = "")) }
            if (line.lineType == "CUSTOM") {
                OutlinedTextField(line.itemName, { onLine(index, line.copy(itemName = it)) }, label = { Text("Item name") })
            } else {
                SelectField("Item", line.sourceId, masters.map { it.id to it.name }) { id -> val master = masters.first { it.id == id }; onLine(index, line.copy(sourceId = id, rate = master.rate.orEmpty(), taxRate = master.taxRate.orEmpty())) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedTextField(line.quantity, { onLine(index, line.copy(quantity = it)) }, label = { Text("Qty") }, modifier = Modifier.weight(1f))
                OutlinedTextField(line.rate, { onLine(index, line.copy(rate = it)) }, label = { Text("Rate") }, modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SelectField("Discount", line.discountType, listOf("" to "None", "PERCENTAGE" to "%", "FIXED" to "Fixed"), Modifier.weight(1f)) { onLine(index, line.copy(discountType = it)) }
                OutlinedTextField(line.discountValue, { onLine(index, line.copy(discountValue = it)) }, label = { Text("Discount") }, modifier = Modifier.weight(1f))
            }
            OutlinedTextField(line.taxRate, { onLine(index, line.copy(taxRate = it)) }, label = { Text("GST %") })
            if (line.sourceId.isNotBlank() && masters.firstOrNull { it.id == line.sourceId }?.trackInventory == true) {
                SelectField("Warehouse", line.warehouseId, options.warehouses.filter { it.branchId == draft.branchId }.map { it.id to it.name }) { onLine(index, line.copy(warehouseId = it)) }
            }
            if (draft.lines.size > 1) TextButton(onClick = { onRemove(index) }) { Text("Remove line") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SelectField(label: String, value: String, values: List<Pair<String, String>>, modifier: Modifier = Modifier, onChange: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = open, onExpandedChange = { open = !open }, modifier = modifier) {
        OutlinedTextField(
            value = values.firstOrNull { it.first == value }?.second.orEmpty(),
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
        )
        ExposedDropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            values.forEach { (id, text) -> DropdownMenuItem(text = { Text(text) }, onClick = { onChange(id); open = false }) }
        }
    }
}
